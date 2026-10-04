import { riskCategories, riskStatuses, riskStrategies } from "./risk-policy.ts";
import { validPlanningMonth, validPlanningDate } from "./planning-dates.ts";
import { personDaySchema } from "./calendar-rules.ts";
export { personDaySchema } from "./calendar-rules.ts";
const bad = (message: string) => Object.assign(Error(message), { status: 400 });
import { z } from "zod";
import type { Data, Resource } from "./model.ts";
import {
  assertResourceDates,
  unchangedLegacyPeriod,
} from "./resource-policy.ts";
import { statuses, phasePalette, actualVersionAt } from "./model.ts";
import {
  normalizeResourceDate,
  resourceMonthFraction,
} from "./resource-dates.ts";
import {
  actualInputToFte,
  createPersonMonthHoursIndex,
  HOURS_PER_WORKDAY,
  MAX_RECORDED_MONTHLY_HOURS,
} from "./actual-units.ts";
import {
  assertPointRange,
  CRITICAL_DATE_OVERLAP_MESSAGE,
} from "./milestone-ranges.ts";
export {
  actualInputToFte,
  calendarHoursInMonth,
  personHoursInMonth,
  leaveHoursInMonth,
  trainingHoursInMonth,
  effectivePersonHoursInMonth,
  workdaysInMonth,
  DEFAULT_MONTHLY_HOURS,
  HOURS_PER_WORKDAY,
} from "./actual-units.ts";
export { migrate } from "./model.ts";
export { versionAt } from "./model.ts";
export { actualVersionAt } from "./model.ts";
export { actualTeamTotalIndex } from "./model.ts";
export { currentPlanningMonth } from "./resource-dates.ts";
export { resourceMonthFraction } from "./resource-dates.ts";
export { isActualStatus } from "./model.ts";
export { visibleActualVersion } from "./model.ts";
export { activeTeamMembers } from "./model.ts";
export { buildCapacityIndex } from "./metrics.ts";
export { scopeData, allowedTeam, visibleTeamScope } from "./access.ts";
export { prepareImport, sourceRows, importColumns } from "./resource-import.ts";
const mo = z.string().refine(validPlanningMonth, "Geçersiz ay.");
const day = z.string().refine(validPlanningDate, "Geçersiz gün.");
const ver = z.object({
  effective: mo,
  team: z.string(),
  lead: z.string().optional(),
  status: z.enum(statuses as [string, ...string[]]),
  included: z.boolean(),
  start: z.union([day, mo, z.literal("")]),
  end: z.union([day, mo, z.literal("")]),
  amount: z.number().min(0).max(100),
});
const res = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  note: z.string().max(10000),
  code: z.string().trim().max(100).optional(),
  versions: z.array(ver).min(1).max(200),
});
const milestoneNote = z.object({
  text: z.string().trim().min(1),
  includeInReport: z.boolean(),
  completed: z.boolean().optional(),
  start: day.optional(),
  end: day.optional(),
});
const milestone = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
  name: z.string().trim().min(1).max(200),
  start: day,
  end: day,
  displayKind: z.enum(["range", "milestone"]).optional(),
  diamondStyle: z.enum(["solid", "outline"]).optional(),
  hasCriticalTopics: z.boolean().optional(),
  additionalRanges: z
    .array(
      z.object({
        start: day,
        end: day,
        displayKind: z.enum(["range", "milestone"]).optional(),
        diamondStyle: z.enum(["solid", "outline"]).optional(),
        description: z.string().trim().optional(),
        notes: z.array(milestoneNote).max(10).optional(),
        color: z
          .enum(phasePalette.map((x) => x.id) as [string, ...string[]])
          .optional(),
      }),
    )
    .max(19)
    .optional(),
  barColor: z
    .enum(phasePalette.map((x) => x.id) as [string, ...string[]])
    .optional(),
  barStyle: z.enum(["solid", "striped", "outline"]).optional(),
  barText: z.string().trim().optional(),
  barNotes: z.array(milestoneNote).max(10).optional(),
});
const proj = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(1000000000).optional(),
  responsibleName: z.string().trim().max(200).optional(),
  start: mo,
  end: mo,
  phases: z.record(z.string().max(3000)),
  phaseColors: z
    .record(mo, z.enum(phasePalette.map((x) => x.id) as [string, ...string[]]))
    .optional(),
  milestones: z.array(milestone).max(100).optional(),
});
const risk = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
    projectId: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
    reportedBy: z.string().trim().min(1).max(200),
    category: z.enum(riskCategories),
    reportedAt: day,
    system: z.string().trim().max(200),
    description: z.string().trim().min(1).max(5000),
    cause: z.string().trim().max(5000),
    actionPlan: z.string().trim().max(5000),
    targetAt: z.union([day, z.literal("")]),
    status: z.enum(riskStatuses),
    owner: z.string().trim().max(200),
    likelihood: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    strategy: z.enum(riskStrategies),
    implementedAt: z.union([day, z.literal("")]),
    actionResult: z.string().trim().max(5000),
    residualLikelihood: z.number().int().min(1).max(5).nullable(),
    residualImpact: z.number().int().min(1).max(5).nullable(),
    createdBy: z.string().min(1).max(120),
    createdByName: z.string().trim().min(1).max(150),
    createdAt: z.string().min(1).max(40),
    updatedAt: z.string().min(1).max(40),
  })
  .strict();
const credentialSchema = z.object({
  salt: z.string(),
  iv: z.string(),
  wrappedKey: z.string(),
  version: z.string().min(1),
});
const accountSchema = z.object({
  id: z.string().min(1),
  username: z.string().regex(/^[a-z0-9._@+-]{3,100}$/),
  name: z.string().trim().min(1).max(150),
  role: z.enum(["admin", "manager", "normal"]),
  leaders: z.array(z.string()),
  active: z.boolean(),
  credential: credentialSchema.optional(),
});
// Validate entries before rebuilding the dictionary. z.record intentionally
// drops __proto__, which is also a permitted leadership name in existing data.
const leaderManagersSchema = z
  .custom<Record<string, unknown>>(
    (value) =>
      value !== null &&
      typeof value === "object" &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
    "Geçersiz liderlik yöneticisi kaydı.",
  )
  .transform((value) => Object.entries(value))
  .pipe(z.array(z.tuple([z.string(), z.string().trim().max(200)])))
  .transform((entries) => Object.fromEntries(entries));

const schema = z.object({
  teams: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(200),
        lead: z.string(),
        managerName: z.string().trim().max(200).optional(),
        excelCapacity: z.number(),
        catalog: z.boolean().optional(),
      }),
    )
    .min(1),
  resources: z.array(res),
  projects: z.array(proj),
  risks: z.array(risk).max(100000).default([]),
  allocations: z.record(z.number().min(0).max(10000)),
  actualAllocations: z.record(z.number().min(0).max(100)).optional(),
  actualWorkedHours: z
    .record(z.number().min(0).max(MAX_RECORDED_MONTHLY_HOURS))
    .optional(),
  actualPercentEntries: z.record(z.number().min(0).max(10000)).optional(),
  workCalendar: z
    .record(
      z.object({
        type: z.enum(["official", "religious", "company"]),
        label: z.string().trim().min(1).max(100),
        fraction: z.union([z.literal(0.5), z.literal(1)]),
      }),
    )
    .default({}),
  personCalendar: z.record(personDaySchema).default({}),
  revisions: z.record(z.number().int().min(0)),
  leaders: z.array(z.string()).optional(),
  leaderManagers: leaderManagersSchema.default({}),
  catalogVersion: z.number().optional(),
  users: z.array(accountSchema).optional(),
  legacyArchive: z
    .object({
      teams: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          lead: z.string(),
          excelCapacity: z.number(),
          catalog: z.boolean().optional(),
        }),
      ),
      allocations: z.record(z.number()),
      resourceTeams: z.record(z.string()),
    })
    .optional(),
});
export function validate(
  input: unknown,
  options: { previousResources?: readonly Resource[] } = {},
): Data {
  const previous = new Map(
    (options.previousResources || []).map((r) => [
      r.id,
      new Map(r.versions.map((v) => [v.effective, v])),
    ]),
  );
  const d = schema.parse(input) as Data;
  // Record keys (and their split parts) are already strings. Use the same
  // predicates as the schemas without rebuilding a Zod result for each key.
  delete d.users;
  if (Object.keys(d.workCalendar || {}).length > 5000)
    throw bad("Çalışma takviminde en fazla 5000 tarih bulunabilir.");
  for (const date of Object.keys(d.workCalendar || {}))
    if (!validPlanningDate(date))
      throw bad("Çalışma takviminde geçersiz tarih var.");
  if (Object.keys(d.personCalendar || {}).length > 100000)
    throw bad("Kişisel takvimde çok fazla kayıt var.");
  for (const list of [d.teams, d.projects, d.resources])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw bad("Tekrarlanan kayıt kimliği.");
  const teamIds = new Set(d.teams.map((team) => team.id));
  const projectRanks = d.projects.flatMap((p) =>
    p.sortOrder === undefined ? [] : [p.sortOrder],
  );
  if (new Set(projectRanks).size !== projectRanks.length)
    throw bad("Projelerin sıralama değerleri farklı olmalıdır.");
  const projectsById = new Map(
    d.projects.map((project) => [project.id, project]),
  );
  if (
    new Set((d.risks || []).map((item) => item.id)).size !==
    (d.risks || []).length
  )
    throw bad("Tekrarlanan risk kimliği.");
  for (const item of d.risks || []) {
    if (!projectsById.has(item.projectId))
      throw bad("Risk projesi bulunamadı.");
    if ((item.residualLikelihood === null) !== (item.residualImpact === null))
      throw bad("Aksiyon sonrası olasılık ve etki birlikte girilmeli.");
    if (item.residualLikelihood !== null && !item.implementedAt)
      throw bad(
        "Aksiyon sonrası değerlendirme için devreye alınma tarihi girin.",
      );
  }
  const resourcesById = new Map(
    d.resources.map((resource) => [resource.id, resource]),
  );
  const personalTypes = new Set<string>(),
    dailyPersonalHours = new Map<string, number>();
  for (const [key, entry] of Object.entries(d.personCalendar || {})) {
    const [resourceId, date, type, ...extra] = key.split("|");
    if (
      extra.length ||
      !resourcesById.has(resourceId) ||
      !validPlanningDate(date) ||
      (type !== undefined && type !== entry.type)
    )
      throw bad("Geçersiz kişisel takvim kaydı.");
    const dayKey = resourceId + "|" + date,
      typedKey = dayKey + "|" + entry.type;
    if (personalTypes.has(typedKey))
      throw bad("Aynı gün ve tür için birden fazla izin/eğitim kaydı olamaz.");
    personalTypes.add(typedKey);
    const total = (dailyPersonalHours.get(dayKey) || 0) + entry.hours;
    if (total > HOURS_PER_WORKDAY)
      throw bad(
        `${date}: İzin ve eğitim toplamı günde ${HOURS_PER_WORKDAY} saati aşamaz.`,
      );
    dailyPersonalHours.set(dayKey, total);
  }
  const leaderNames = new Set(d.leaders || []);
  for (const r of d.resources) {
    if (new Set(r.versions.map((v) => v.effective)).size !== r.versions.length)
      throw bad("Aynı ay için birden fazla kaynak değişikliği kaydedilemez.");
    for (const v of r.versions) {
      v.start = normalizeResourceDate(v.start, "start");
      v.end = normalizeResourceDate(v.end, "end");
      if (v.team && !teamIds.has(v.team)) throw bad("Takım bulunamadı.");
      try {
        assertResourceDates(
          v,
          unchangedLegacyPeriod(v, previous.get(r.id)?.get(v.effective)),
        );
      } catch (error) {
        throw bad((error as Error).message);
      }
    }
    for (const departure of r.versions.filter(
      (v) => v.status === "İşten Ayrıldı",
    ))
      for (const v of r.versions)
        if (
          v.effective <= departure.effective &&
          (!v.end || v.end > departure.end)
        ) {
          v.end = departure.end;
          if (v.start && v.end < v.start)
            throw bad(
              "İşten ayrılış tarihi önceki çalışma döneminden önce olamaz.",
            );
        }
  }
  for (const p of d.projects) {
    if (p.start > p.end) throw bad("Projenin bitişi başlangıçtan önce olamaz.");
    const milestones = p.milestones || [];
    if (new Set(milestones.map((m) => m.id)).size !== milestones.length)
      throw bad("Aynı kilometre taşı kimliği iki kez kullanılamaz.");
    for (const m of milestones) {
      if (m.hasCriticalTopics === false) {
        if (
          m.displayKind === "milestone" ||
          m.additionalRanges?.length ||
          m.barNotes?.length ||
          m.barText?.trim()
        )
          throw bad("Kritik konusu olmayan bilgi açıklama içeremez.");
        continue;
      }
      const ranges = [
        {
          start: m.start,
          end: m.end,
          notes: m.barNotes,
          displayKind: m.displayKind,
          description:
            m.barText || (m.displayKind === "milestone" ? m.name : ""),
        },
        ...(m.additionalRanges || []),
      ].sort((a, b) => a.start.localeCompare(b.start));
      for (const [index, range] of ranges.entries()) {
        try {
          assertPointRange(range);
        } catch (error) {
          throw bad((error as Error).message);
        }
        if (
          range.start > range.end ||
          range.start < p.start + "-01" ||
          range.end.slice(0, 7) > p.end
        )
          throw bad("Kilometre taşı proje dönemi içinde olmalı.");
        if (index && range.start <= ranges[index - 1].end)
          throw bad(CRITICAL_DATE_OVERLAP_MESSAGE);
        for (const note of range.notes || []) {
          const noteStart = note.start ?? range.start,
            noteEnd = note.end ?? range.end;
          if (
            noteStart > noteEnd ||
            noteStart < p.start + "-01" ||
            noteEnd.slice(0, 7) > p.end
          )
            throw bad(
              "Açıklama tarihleri geçerli sırada ve proje dönemi içinde olmalı.",
            );
        }
      }
    }
  }
  for (const k of Object.keys(d.allocations)) {
    const n = d.allocations[k];
    const [t, p, m, ...extra] = k.split("|");
    if (extra.length || !teamIds.has(t) || !validPlanningMonth(m))
      throw bad("Geçersiz dağıtım kaydı.");
    const pr = projectsById.get(p);
    if (!pr || (n > 0 && (m < pr.start || m > pr.end)))
      throw bad("Proje tarihleri dışında kaynak dağıtımı var.");
  }
  d.actualAllocations ??= {};
  for (const k of Object.keys(d.actualAllocations)) {
    const n = d.actualAllocations[k];
    const [resourceId, projectId, month, ...extra] = k.split("|");
    const resource = resourcesById.get(resourceId),
      project = projectsById.get(projectId);
    if (
      extra.length ||
      !resource ||
      !project ||
      !validPlanningMonth(month) ||
      (n > 0 && (month < project.start || month > project.end))
    )
      throw bad("Geçersiz gerçekleşen dağılım kaydı.");
  }
  d.actualWorkedHours ??= {};
  for (const key of Object.keys(d.actualWorkedHours)) {
    const [resourceId, month, ...extra] = key.split("|");
    if (
      extra.length ||
      !resourcesById.has(resourceId) ||
      !validPlanningMonth(month)
    )
      throw bad("Geçersiz çalışılan saat kaydı.");
  }
  d.actualPercentEntries ??= {};
  const personHours = createPersonMonthHoursIndex(d);
  for (const key of Object.keys(d.actualPercentEntries)) {
    const percent = d.actualPercentEntries[key];
    const [resourceId, projectId, month, ...extra] = key.split("|");
    if (
      extra.length ||
      !resourcesById.has(resourceId) ||
      !projectsById.has(projectId) ||
      !validPlanningMonth(month) ||
      d.actualAllocations[key] === undefined
    )
      throw bad("Geçersiz yüzde dağılımı kaydı.");
    const hours = personHours.get(resourceId, month).effectiveHours;
    const expected = actualInputToFte(percent, "percent", month, hours);
    if (Math.abs(expected - d.actualAllocations[key]) > 1e-8)
      throw bad("Yüzde dağılımı çalışılan saatlerle eşleşmiyor.");
  }
  for (const list of [d.teams, d.projects, d.resources])
    for (const item of list)
      if (!/^[a-zA-Z0-9_-]{1,120}$/.test(item.id))
        throw bad("Geçersiz kimlik.");
  for (const t of d.teams)
    if (t.lead && !leaderNames.has(t.lead)) throw bad("Geçersiz liderlik.");
  for (const name of Object.keys(d.leaderManagers || {}))
    if (!leaderNames.has(name)) throw bad("Geçersiz liderlik yöneticisi.");
  for (const p of d.projects)
    for (const m of Object.keys(p.phases))
      if (!validPlanningMonth(m)) throw bad("Geçersiz proje ayı.");
  return d;
}
