import { ownValue } from "../shared/records.ts";
import { parseAllocationKey } from "../shared/allocation-key.ts";
import { assertActualMonthlyLimits } from "../shared/actual-limits.ts";
import { z } from "zod";
import { fail, admin, publicUser } from "./auth.mjs";
import {
  allowedTeam,
  prepareImport,
  validate,
  migrate,
  versionAt,
  actualVersionAt,
} from "./domain/index.mjs";
import { entityCollections as kinds } from "../shared/entity-kinds.ts";
import { orderedProjects } from "../shared/project-order.ts";
import { stageRiskChange, stageRiskSystemChange } from "./risk-commands.mjs";
import {
  DIRECTORY_REVISION_KEY,
  directoryRevision,
} from "../shared/directory-policy.ts";
import { stageTeamChange } from "./directory-commands.mjs";
import {
  stageActualChange,
  stageWorkedHoursChange,
  stageCalendarChange,
  stagePersonDayChange,
  finalizeActualChanges,
} from "./actual-calendar-commands.mjs";
// Keep the existing operations entry point for routes, tools and tests.
export { applyLeaderChange } from "./directory-commands.mjs";
const id = z.string().regex(/^[a-zA-Z0-9_|-]{1,300}$/);
const changesSchema = z
  .array(
    z.object({
      kind: z.enum([
        "team",
        "project",
        "risk",
        "riskSystem",
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
export function applyChanges(d, u, input) {
  const previousResources = structuredClone(d.resources);
  stageChanges(d, u, input);
  Object.assign(d, validate(d, { previousResources }));
  return d;
}

// Store.mutate validates the final draft before persistence. Standalone callers
// use applyChanges above, which retains full validation and normalization.
export function stageChanges(d, u, input) {
  return stageParsedChanges(d, u, changesSchema.parse(input));
}

const planningCommands = new WeakSet();

// Only this owned command can use an allocation/revision-only draft. Re-check
// the parsed kinds when invoked inside the transaction, before touching data.
export function planningCommand(input) {
  const command = (d, u) => {
    const changes = changesSchema.parse(input);
    if (!changes.every((change) => change.kind === "allocation"))
      fail(400, "Yalnız planlanan kaynak dağılımı işlemleri kullanılabilir.");
    return stageParsedChanges(d, u, changes);
  };
  planningCommands.add(command);
  return command;
}

export const isPlanningCommand = (command) => planningCommands.has(command);

function stageParsedChanges(d, u, changes) {
  const seen = new Set(),
    affectedActualMonths = new Set();
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
    // Final snapshot validation cannot see deleted keys. Validate their targets
    // before deletion, and never manufacture tombstones for empty cells.
    // Authorization and revision checks must still run for these no-op clears.
    if (operation && (kind === "allocation" || kind === "actual")) {
      const parts = parseAllocationKey(id);
      if (!parts) fail(400, "Dağıtım kaydı kimliği geçersiz.");
      const [ownerId, projectId] = parts;
      const owners = kind === "allocation" ? d.teams : d.resources;
      if (
        !owners.some((item) => item.id === ownerId) ||
        !d.projects.some((item) => item.id === projectId)
      )
        fail(404, "Dağıtım kaydının takım, çalışan veya projesi bulunamadı.");
      const entries =
        kind === "allocation" ? d.allocations : d.actualAllocations;
      if (
        ownValue(entries || {}, id) === undefined &&
        (kind !== "actual" ||
          ownValue(d.actualPercentEntries || {}, id) === undefined)
      )
        continue;
    }
    if (kind === "riskSystem") {
      stageRiskSystemChange(d, ch);
    } else if (kind === "risk") {
      stageRiskChange(d, u, ch, existingRisk);
    } else if (kind === "allocation") {
      if (operation) delete d.allocations[id];
      else d.allocations[id] = value;
    } else if (kind === "actual") {
      stageActualChange(d, ch, affectedActualMonths);
    } else if (kind === "workedHours") {
      if (!stageWorkedHoursChange(d, ch, affectedActualMonths)) continue;
    } else if (kind === "calendar") {
      stageCalendarChange(d, ch, affectedActualMonths);
    } else if (kind === "personDay") {
      if (!stagePersonDayChange(d, ch, affectedActualMonths)) continue;
    } else if (kind === "team") {
      stageTeamChange(d, ch);
    } else {
      const c = kinds[kind];
      if (operation) {
        if (!d[c].some((x) => x.id === id)) fail(404, "Kayıt bulunamadı.");
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
        let nextValue = value;
        if (kind === "project" && value.sortOrder === undefined) {
          const previous = d.projects.find((p) => p.id === id);
          if (previous?.sortOrder !== undefined)
            nextValue = { ...value, sortOrder: previous.sortOrder };
          else if (
            !previous &&
            d.projects.some((p) => p.sortOrder !== undefined)
          )
            nextValue = {
              ...value,
              sortOrder:
                d.projects.reduce(
                  (max, p) => Math.max(max, p.sortOrder ?? -1),
                  -1,
                ) + 1,
            };
        }
        d[c] = [...d[c].filter((x) => x.id !== id), nextValue];
      }
    }
    d.revisions[k] = revision + 1;
  }
  // Validate the final batch: moving allocations between projects or adjusting
  // a calendar together with allocations must not fail on an intermediate total.
  // Recalculate only after explicit revisions have been checked for every change.
  finalizeActualChanges(d, affectedActualMonths);
  if (changes.some((change) => change.kind === "project"))
    d.projects = orderedProjects(d.projects);
  return d;
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
  // An existing undated employment period may be restored unchanged; a JSON
  // upload cannot introduce new undated resources/periods or change their policy.
  const next = validate(migrate(backup), { previousResources: d.resources });
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
  // Even an identical JSON restore invalidates previously opened catalog drafts.
  next.revisions[DIRECTORY_REVISION_KEY] = directoryRevision(d) + 1;
  // An absent optional archive in the backup must clear the current archive.
  if (!Object.hasOwn(next, "legacyArchive")) delete d.legacyArchive;
  Object.assign(d, next);
}
