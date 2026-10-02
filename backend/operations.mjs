import { ownValue } from "../shared/records.ts";
import { assertActualMonthlyLimits } from "../shared/actual-limits.ts";
import {
  MAX_RECORDED_MONTHLY_HOURS,
  createPersonMonthHoursIndex,
} from "../shared/actual-units.ts";
import { z } from "zod";
import { fail, admin, publicUser } from "./auth.mjs";
import {
  allowedTeam,
  prepareImport,
  validate,
  migrate,
  versionAt,
  actualVersionAt,
  currentPlanningMonth,
  actualInputToFte,
  effectivePersonHoursInMonth,
  DEFAULT_MONTHLY_HOURS,
  personDaySchema,
} from "./domain/index.mjs";
import { entityCollections as kinds } from "../shared/entity-kinds.ts";
const id = z.string().regex(/^[a-zA-Z0-9_|-]{1,300}$/);
const changesSchema = z
  .array(
    z.object({
      kind: z.enum([
        "team",
        "project",
        "risk",
        "resource",
        "allocation",
        "actual",
        "workedHours",
        "calendar",
        "personDay",
      ]),
      id,
      value: z.unknown().optional(),
      revision: z.number().int().nonnegative(),
      operation: z.literal("delete").optional(),
    }),
  )
  .min(1)
  .max(100000);
const actualEntrySchema = z
  .object({
    unit: z.enum(["percent", "days", "hours"]),
    value: z.number().finite().min(0).max(100000),
  })
  .strict();
const workedHoursSchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_RECORDED_MONTHLY_HOURS);
const calendarSchema = z.record(
  z
    .object({
      type: z.enum(["official", "religious", "company"]),
      label: z.string().trim().min(1).max(100),
      fraction: z.union([z.literal(0.5), z.literal(1)]),
    })
    .strict(),
);
const effectiveHours = (d, resourceId, month) =>
  effectivePersonHoursInMonth(
    month,
    resourceId,
    d.actualWorkedHours?.[resourceId + "|" + month],
    d.workCalendar,
    d.personCalendar,
  );
function recalculateActualPercentages(d, affectedMonths) {
  if (affectedMonths.size === 0) return;
  const resources = new Set(d.resources.map((resource) => resource.id));
  const personHours = createPersonMonthHoursIndex(d);
  // Scan once for the entire final batch; a calendar edit may affect every
  // person. Do not cache during the command loop, where calendars/hours change.
  for (const actualKey of Object.keys(d.actualPercentEntries || {})) {
    const [entryResource, , entryMonth] = actualKey.split("|");
    if (
      !resources.has(entryResource) ||
      !affectedMonths.has(entryResource + "|" + entryMonth)
    )
      continue;
    const percent = d.actualPercentEntries[actualKey];
    const hours = personHours.get(entryResource, entryMonth).effectiveHours;
    const nextPercent = hours
      ? (((d.actualAllocations[actualKey] || 0) * DEFAULT_MONTHLY_HOURS) /
          hours) *
        100
      : 0;
    if (Math.abs(percent - nextPercent) > 1e-10) {
      d.actualPercentEntries[actualKey] = nextPercent;
      d.revisions["actual:" + actualKey] =
        (d.revisions["actual:" + actualKey] || 0) + 1;
    }
  }
}
export function applyChanges(d, u, input) {
  stageChanges(d, u, input);
  Object.assign(d, validate(d));
  return d;
}

// Store.mutate validates the final draft before persistence. Standalone callers
// use applyChanges above, which retains full validation and normalization.
export function stageChanges(d, u, input) {
  const changes = changesSchema.parse(input),
    seen = new Set(),
    affectedActualMonths = new Set();
  const affectMonth = (resourceId, month) =>
    affectedActualMonths.add(resourceId + "|" + month);
  for (const ch of changes) {
    const { kind, id, value, revision, operation } = ch,
      k = kind + ":" + id;
    if (seen.has(k)) fail(400, "Tekrarlanan işlem.");
    seen.add(k);
    const targetId = id.split("|")[0];
    const managerPlan =
      u.role === "manager" &&
      kind === "allocation" &&
      allowedTeam(d, publicUser(u), targetId);
    const actualKind = kind === "actual" || kind === "workedHours";
    const month = actualKind ? id.split("|")[kind === "actual" ? 2 : 1] : "";
    const resource = actualKind
      ? d.resources.find((item) => item.id === targetId)
      : undefined;
    const assignment =
      resource && month ? actualVersionAt(resource, month) : undefined;
    const managerActual =
      u.role === "manager" &&
      actualKind &&
      !!assignment &&
      allowedTeam(d, publicUser(u), assignment.team);
    const ownActual =
      u.role === "normal" &&
      !!u.resourceId &&
      targetId === u.resourceId &&
      actualKind;
    const ownDay =
      kind === "personDay" && !!u.resourceId && targetId === u.resourceId;
    const existingRisk =
      kind === "risk" ? d.risks?.find((item) => item.id === id) : undefined;
    const canRisk =
      kind === "risk" &&
      (!operation || u.role !== "normal") &&
      (u.role === "manager" ||
        u.role === "admin" ||
        !existingRisk ||
        existingRisk.createdBy === u._id);
    if (
      u.role !== "admin" &&
      !managerPlan &&
      !managerActual &&
      !ownActual &&
      !ownDay &&
      !canRisk
    )
      fail(403, "Bu işlem için yetkiniz yok.");
    if (ownActual && !resource) fail(404, "Çalışan kaynak bulunamadı.");
    if ((d.revisions[k] || 0) !== revision)
      fail(
        409,
        "Kayıt başka kullanıcı tarafından değiştirildi. Yenileyip tekrar deneyin.",
      );
    if (
      kind === "actual" &&
      !operation &&
      id.split("|")[2] > currentPlanningMonth()
    )
      fail(400, "Gelecek aylara gerçekleşen kaynak dağılımı girilemez.");
    if (kind === "risk") {
      d.risks ??= [];
      if (operation) {
        if (!existingRisk) fail(404, "Risk kaydı bulunamadı.");
        d.risks = d.risks.filter((item) => item.id !== id);
      } else {
        if (!value || value.id !== id) fail(400, "Risk kimliği eşleşmiyor.");
        if (existingRisk && value.projectId !== existingRisk.projectId)
          fail(400, "Risk başka projeye taşınamaz.");
        if (!d.projects.some((item) => item.id === value.projectId))
          fail(404, "Proje bulunamadı.");
        const now = new Date().toISOString();
        const next = {
          ...value,
          createdBy: existingRisk?.createdBy || u._id,
          createdByName: existingRisk?.createdByName || u.name,
          createdAt: existingRisk?.createdAt || now,
          updatedAt: now,
        };
        d.risks = [...d.risks.filter((item) => item.id !== id), next];
      }
    } else if (kind === "allocation") {
      if (operation) delete d.allocations[id];
      else d.allocations[id] = value;
    } else if (kind === "actual") {
      d.actualAllocations ??= {};
      d.actualPercentEntries ??= {};
      if (operation) {
        delete d.actualAllocations[id];
        delete d.actualPercentEntries[id];
      } else if (typeof value === "number") {
        d.actualAllocations[id] = value;
        delete d.actualPercentEntries[id];
      } else {
        const entry = actualEntrySchema.parse(value);
        const [resourceId, , month] = id.split("|");
        if (entry.unit === "percent" && entry.value > 100)
          fail(400, "Yüzde girişi %100'ü aşamaz.");
        const amount = actualInputToFte(
          entry.value,
          entry.unit,
          month,
          effectiveHours(d, resourceId, month),
        );
        if (!Number.isFinite(amount) || amount > 100)
          fail(400, "Giriş, izin verilen kaynak sınırını aşıyor.");
        d.actualAllocations[id] = amount;
        if (entry.unit === "percent") d.actualPercentEntries[id] = entry.value;
        else delete d.actualPercentEntries[id];
      }
      const [resourceId, , month] = id.split("|");
      if (resourceId && month) affectMonth(resourceId, month);
    } else if (kind === "workedHours") {
      const [resourceId, month, ...extra] = id.split("|");
      if (
        extra.length ||
        !resourceId ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")
      )
        fail(400, "Çalışılan saat kaydı geçersiz.");
      if (!d.resources.some((resource) => resource.id === resourceId))
        fail(404, "Çalışan kaynak bulunamadı.");
      if (!operation && value !== null && month > currentPlanningMonth())
        fail(400, "Gelecek aylara çalışılan saat girilemez.");
      d.actualWorkedHours ??= {};
      if (operation || value === null) delete d.actualWorkedHours[id];
      else d.actualWorkedHours[id] = workedHoursSchema.parse(value);
      affectMonth(resourceId, month);
    } else if (kind === "calendar") {
      if (id !== "shared" || operation)
        fail(400, "Çalışma takvimi işlemi geçersiz.");
      const previous = d.workCalendar || {};
      const next = calendarSchema.parse(value);
      const changedMonths = new Set(
        [...new Set([...Object.keys(previous), ...Object.keys(next)])]
          .filter((date) => previous[date]?.fraction !== next[date]?.fraction)
          .map((date) => date.slice(0, 7)),
      );
      d.workCalendar = next;
      for (const key of Object.keys(d.actualAllocations || {})) {
        const [resourceId, , month] = key.split("|");
        if (changedMonths.has(month)) affectMonth(resourceId, month);
      }
      for (const key of Object.keys(d.personCalendar || {})) {
        const [resourceId, date] = key.split("|");
        const month = date.slice(0, 7);
        if (changedMonths.has(month)) affectMonth(resourceId, month);
      }
    } else if (kind === "personDay") {
      const [resourceId, date, type, ...extra] = id.split("|");
      if (
        extra.length ||
        (type !== undefined && !["leave", "training"].includes(type)) ||
        !d.resources.some((resource) => resource.id === resourceId) ||
        !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date || "") ||
        Number.isNaN(Date.parse(date + "T12:00:00Z")) ||
        new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
      )
        fail(400, "Kişisel takvim tarihi geçersiz.");
      d.personCalendar ??= {};
      if (operation) delete d.personCalendar[id];
      else {
        const entry = personDaySchema.parse(value);
        if (type !== undefined && type !== entry.type)
          fail(400, "Takvim kayıt türü kimliğiyle eşleşmiyor.");
        if (d.personCalendar[id] && d.personCalendar[id].type !== entry.type)
          fail(
            400,
            "Bu tarihte farklı türde kayıt var. İzin ve eğitimi ayrı kayıtlar olarak ekleyin.",
          );
        d.personCalendar[id] = entry;
      }
      const month = date.slice(0, 7);
      affectMonth(resourceId, month);
    } else {
      const c = kinds[kind];
      if (operation) {
        if (!d[c].some((x) => x.id === id)) fail(404, "Kayıt bulunamadı.");
        if (kind === "team" && d.teams.length <= 1)
          fail(409, "Son takım silinemez.");
        if (
          kind === "team" &&
          (d.resources.some((r) => r.versions.some((v) => v.team === id)) ||
            Object.keys(d.allocations).some((k) => k.split("|")[0] === id))
        )
          fail(409, "Kullanılan takım silinemez.");
        if (kind === "project") {
          for (const risk of d.risks || [])
            if (risk.projectId === id)
              d.revisions["risk:" + risk.id] =
                (d.revisions["risk:" + risk.id] || 0) + 1;
          d.risks = (d.risks || []).filter((risk) => risk.projectId !== id);
          for (const key of Object.keys(d.allocations))
            if (key.split("|")[1] === id) {
              delete d.allocations[key];
              d.revisions["allocation:" + key] =
                (d.revisions["allocation:" + key] || 0) + 1;
            }
          for (const key of Object.keys(d.actualAllocations || {}))
            if (key.split("|")[1] === id) {
              delete d.actualAllocations[key];
              d.revisions["actual:" + key] =
                (d.revisions["actual:" + key] || 0) + 1;
            }
          for (const key of Object.keys(d.actualPercentEntries || {}))
            if (key.split("|")[1] === id) delete d.actualPercentEntries[key];
          for (const key of Object.keys(d.legacyArchive?.allocations || {}))
            if (key.split("|")[1] === id)
              delete d.legacyArchive.allocations[key];
        }
        d[c] = d[c].filter((x) => x.id !== id);
        if (kind === "resource") {
          for (const key of Object.keys(d.actualAllocations || {}))
            if (key.split("|")[0] === id) {
              delete d.actualAllocations[key];
              delete d.actualPercentEntries?.[key];
              d.revisions["actual:" + key] =
                (d.revisions["actual:" + key] || 0) + 1;
            }
          for (const key of Object.keys(d.actualWorkedHours || {}))
            if (key.split("|")[0] === id) {
              delete d.actualWorkedHours[key];
              d.revisions["workedHours:" + key] =
                (d.revisions["workedHours:" + key] || 0) + 1;
            }
          for (const key of Object.keys(d.personCalendar || {}))
            if (key.split("|")[0] === id) {
              delete d.personCalendar[key];
              d.revisions["personDay:" + key] =
                (d.revisions["personDay:" + key] || 0) + 1;
            }
        }
      } else {
        if (!value || value.id !== id) fail(400, "Kimlik eşleşmiyor.");
        if (kind === "team") {
          const previous = d.teams.find((t) => t.id === id);
          if (previous && previous.lead !== value.lead) {
            for (const resource of d.resources) {
              let changed = false;
              for (const version of resource.versions)
                if (version.team === id) {
                  version.lead = value.lead;
                  changed = true;
                }
              if (changed)
                d.revisions["resource:" + resource.id] =
                  (d.revisions["resource:" + resource.id] || 0) + 1;
            }
          }
        }
        d[c] = [...d[c].filter((x) => x.id !== id), value];
      }
    }
    d.revisions[k] = revision + 1;
  }
  // Validate the final batch: moving allocations between projects or adjusting
  // a calendar together with allocations must not fail on an intermediate total.
  // Recalculate only after explicit revisions have been checked for every change.
  assertActualMonthlyLimits(d, affectedActualMonths);
  recalculateActualPercentages(d, affectedActualMonths);
  return d;
}
const leaderChangeSchema = z.object({
  action: z.enum(["rename", "update", "delete"]),
  name: z.string().trim().min(1).max(200),
  newName: z.string().trim().min(1).max(200).optional(),
  managerName: z.string().trim().max(200).optional(),
  generation: z.number().int().nonnegative(),
});
export async function applyLeaderChange(d, u, input, c, generation) {
  admin(u);
  const change = leaderChangeSchema.parse(input);
  if (change.generation !== generation)
    fail(409, "Liderlik listesi değişti. Yenileyip tekrar deneyin.");
  if (!d.leaders?.includes(change.name)) fail(404, "Liderlik bulunamadı.");
  const linkedUsers = (
    await c.query("SELECT * FROM kp_user_leaders WHERE leader_name=@p0", [
      change.name,
    ])
  ).rows;
  if (change.action === "rename" || change.action === "update") {
    const newName = change.newName || change.name;
    const oldManager = ownValue(d.leaderManagers, change.name) || "";
    const managerName = change.managerName ?? oldManager;
    const renamed = newName !== change.name;
    if (change.action === "rename" && !renamed)
      fail(400, "Farklı bir liderlik adı girin.");
    if (renamed && d.leaders.includes(newName))
      fail(400, "Benzersiz bir liderlik adı girin.");
    if (!renamed && managerName === oldManager)
      fail(400, "Değiştirilecek liderlik bilgisi yok.");
    d.leaderManagers ??= {};
    delete d.leaderManagers[change.name];
    if (managerName)
      d.leaderManagers = { ...d.leaderManagers, [newName]: managerName };
    if (renamed) {
      await c.upsert("leaders", [{ name: newName, manager_name: managerName }]);
      d.leaders = d.leaders.map((name) =>
        name === change.name ? newName : name,
      );
      for (const team of d.teams)
        if (team.lead === change.name) {
          team.lead = newName;
          d.revisions["team:" + team.id] =
            (d.revisions["team:" + team.id] || 0) + 1;
        }
      for (const resource of d.resources) {
        let changed = false;
        for (const version of resource.versions)
          if (version.lead === change.name) {
            version.lead = newName;
            changed = true;
          }
        if (changed)
          d.revisions["resource:" + resource.id] =
            (d.revisions["resource:" + resource.id] || 0) + 1;
      }
      await c.upsert(
        "user_leaders",
        linkedUsers.map((row) => ({
          user_id: row.user_id,
          leader_name: newName,
        })),
      );
      await c.remove(
        "user_leaders",
        linkedUsers.map((row) => ({
          user_id: row.user_id,
          leader_name: change.name,
        })),
      );
    }
  } else {
    if (linkedUsers.length)
      fail(
        409,
        "Liderlik kullanıcı yetkilerinde kullanılıyor. Önce yetkileri güncelleyin.",
      );
    const teams = d.teams.filter((team) => team.lead === change.name),
      ids = new Set(teams.map((team) => team.id));
    if (d.teams.length <= teams.length)
      fail(409, "Son takım veya liderlik silinemez.");
    if (
      d.resources.some((resource) =>
        resource.versions.some(
          (version) => ids.has(version.team) || version.lead === change.name,
        ),
      ) ||
      Object.keys(d.allocations).some((key) => ids.has(key.split("|")[0]))
    )
      fail(
        409,
        "Bu liderliğe bağlı çalışan kaynak veya planlanan dağılım var. Önce bağlı kayıtları taşıyın ya da temizleyin.",
      );
    d.teams = d.teams.filter((team) => !ids.has(team.id));
    for (const team of teams)
      d.revisions["team:" + team.id] =
        (d.revisions["team:" + team.id] || 0) + 1;
    d.leaders = d.leaders.filter((name) => name !== change.name);
    if (d.leaderManagers) delete d.leaderManagers[change.name];
  }
  Object.assign(d, validate(d));
}
export function reset(d, u, expected) {
  admin(u);
  if (!expected || typeof expected !== "object")
    fail(400, "Sürüm bilgisi eksik.");
  expected = z
    .record(
      z.string().startsWith("allocation:"),
      z.number().int().nonnegative(),
    )
    .parse(expected);
  const actual = Object.fromEntries(
    Object.entries(d.revisions).filter(([k]) => k.startsWith("allocation:")),
  );
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  if ([...keys].some((k) => (actual[k] || 0) !== (expected[k] || 0)))
    fail(409, "Dağılımlar değişti. Yenileyip tekrar deneyin.");
  for (const k of Object.keys(d.allocations)) {
    delete d.allocations[k];
    d.revisions["allocation:" + k] = (d.revisions["allocation:" + k] || 0) + 1;
  }
}
const rowsSchema = z
  .array(
    z.object({
      row: z.number().int(),
      values: z.record(z.union([z.string(), z.number(), z.boolean()])),
      problems: z.array(z.string()),
      date1904: z.boolean(),
    }),
  )
  .min(1)
  .max(5000);
export function importRows(d, u, input) {
  admin(u);
  const rows = prepareImport(d, rowsSchema.parse(input));
  const error = rows.find((r) => r.state === "error");
  if (error)
    fail(400, "Satır " + error.source.row + ": " + error.errors.join(" "));
  let imported = 0;
  for (const row of rows) {
    if (row.state !== "ready") continue;
    const r = row.resource;
    d.resources.push(r);
    d.revisions["resource:" + r.id] = 1;
    const t = d.teams.find((t) => t.id === r.versions[0].team);
    if (t && !t.lead) {
      t.lead = row.lead;
      d.revisions["team:" + t.id] = (d.revisions["team:" + t.id] || 0) + 1;
    }
    imported++;
  }
  return { imported, skipped: rows.length - imported };
}
export function restore(d, u, backup) {
  admin(u);
  if (
    backup?.personAllocations &&
    Object.keys(backup.personAllocations).length
  ) {
    const totals = {};
    for (const [key, amount] of Object.entries(backup.personAllocations)) {
      const [resourceId, projectId, month, ...extra] = key.split("|");
      const resource = backup.resources?.find((r) => r.id === resourceId);
      const team = resource && versionAt(resource, month)?.team;
      if (
        extra.length ||
        !team ||
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 100
      )
        fail(400, "Yedekte geçersiz kişi tahsisi var.");
      const target = team + "|" + projectId + "|" + month;
      totals[target] = (totals[target] || 0) + amount;
    }
    backup = { ...backup, allocations: totals };
  }
  const next = validate(migrate(backup));
  assertActualMonthlyLimits(next);
  // Backup counters belong to another point in time. Rebuild from current
  // revisions, including deleted records, so no stale client becomes current.
  next.revisions = {};
  for (const [kind, c] of Object.entries(kinds)) {
    const ids = new Set([
      ...Object.keys(d.revisions)
        .filter((k) => k.startsWith(kind + ":"))
        .map((k) => k.slice(kind.length + 1)),
      ...(kind === "allocation" || kind === "actual"
        ? Object.keys(next[c] || {})
        : next[c].map((x) => x.id)),
    ]);
    for (const id of ids)
      next.revisions[kind + ":" + id] = (d.revisions[kind + ":" + id] || 0) + 1;
  }
  for (const [kind, collection] of [
    ["workedHours", "actualWorkedHours"],
    ["personDay", "personCalendar"],
  ]) {
    const prefix = kind + ":";
    const ids = new Set([
      ...Object.keys(d.revisions)
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length)),
      ...Object.keys(d[collection] || {}),
      ...Object.keys(next[collection] || {}),
    ]);
    for (const id of ids)
      next.revisions[prefix + id] = (d.revisions[prefix + id] || 0) + 1;
  }
  next.revisions["calendar:shared"] = (d.revisions["calendar:shared"] || 0) + 1;
  // An absent optional archive in the backup must clear the current archive.
  if (!Object.hasOwn(next, "legacyArchive")) delete d.legacyArchive;
  Object.assign(d, next);
}
