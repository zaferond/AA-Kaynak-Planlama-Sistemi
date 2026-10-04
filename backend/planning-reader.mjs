import { readCompositeMap, readRevisionMap } from "./read-records.mjs";
import { visibleTeamScope } from "./domain/index.mjs";

// Read from the caller's snapshot; authorization remains in Store.view/mutate.
export async function readPlanningSnapshot(c, provider, viewUser) {
  const s = (await c.query("SELECT * FROM kp_settings WHERE id=1")).rows[0];
  const leaderRows = (await c.query("SELECT * FROM kp_leaders ORDER BY name"))
    .rows;
  const d = {
    teams: [],
    projects: [],
    risks: [],
    resources: [],
    allocations: {},
    actualAllocations: {},
    actualWorkedHours: {},
    actualPercentEntries: {},
    workCalendar: s.calendar_days ? JSON.parse(s.calendar_days) : {},
    personCalendar: s.person_calendar ? JSON.parse(s.person_calendar) : {},
    revisions: {},
    leaders: leaderRows.map((r) => r.name),
    leaderManagers: Object.fromEntries(
      leaderRows
        .filter((r) => r.manager_name)
        .map((r) => [r.name, r.manager_name]),
    ),
    catalogVersion: 2,
  };
  if (s.legacy_archive) d.legacyArchive = JSON.parse(s.legacy_archive);
  d.teams = (await c.query("SELECT * FROM kp_teams ORDER BY id")).rows.map(
    (r) => ({
      id: r.id,
      name: r.name,
      lead: r.leader_name || "",
      managerName: r.manager_name || "",
      excelCapacity: r.excel_capacity,
      catalog: !!r.catalog,
    }),
  );
  d.projects = (
    await c.query(
      "SELECT * FROM kp_projects ORDER BY CASE WHEN sort_order IS NULL THEN 0 ELSE 1 END,sort_order,id",
    )
  ).rows.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.sort_order !== null && r.sort_order !== undefined
      ? { sortOrder: Number(r.sort_order) }
      : {}),
    responsibleName: r.responsible_name || "",
    start: r.start_month,
    end: r.end_month,
    phases: {},
    phaseColors: {},
    milestones: [],
  }));
  const pm = new Map(d.projects.map((p) => [p.id, p]));
  d.risks = (
    await c.query("SELECT * FROM kp_project_risks ORDER BY id")
  ).rows.map((row) => JSON.parse(row.payload));
  for (const r of (await c.query("SELECT * FROM kp_project_phases")).rows) {
    const p = pm.get(r.project_id);
    if (r.label !== null) p.phases[r.month] = r.label;
    if (r.color) p.phaseColors[r.month] = r.color;
  }
  for (const r of (
    await c.query(
      "SELECT * FROM kp_project_milestones ORDER BY project_id,sort_order,id",
    )
  ).rows) {
    pm.get(r.project_id)?.milestones.push({
      id: r.id,
      name: r.name,
      start: r.start_date || r.start_month + "-01",
      end:
        r.end_date ||
        new Date(
          Date.UTC(
            Number(r.end_month.slice(0, 4)),
            Number(r.end_month.slice(5, 7)),
            0,
          ),
        )
          .toISOString()
          .slice(0, 10),
      barColor: r.bar_color || "red",
      barStyle: r.bar_style || "solid",
      ...(r.display_kind === "milestone" ? { displayKind: "milestone" } : {}),
      ...(r.diamond_style === "outline" ? { diamondStyle: "outline" } : {}),
      ...(Number(r.has_critical_topics) === 0
        ? { hasCriticalTopics: false }
        : {}),
      ...(r.bar_text ? { barText: r.bar_text } : {}),
      ...(r.bar_notes && r.bar_notes !== "[]"
        ? { barNotes: JSON.parse(r.bar_notes) }
        : {}),
      ...(r.extra_ranges && r.extra_ranges !== "[]"
        ? { additionalRanges: JSON.parse(r.extra_ranges) }
        : {}),
    });
  }
  d.resources = (
    await c.query("SELECT * FROM kp_resources ORDER BY id")
  ).rows.map((r) => ({
    id: r.id,
    name: r.name,
    note: r.note,
    ...(r.code ? { code: r.code } : {}),
    versions: [],
  }));
  const rm = new Map(d.resources.map((r) => [r.id, r]));
  for (const r of (
    await c.query("SELECT * FROM kp_resource_versions ORDER BY effective_month")
  ).rows)
    rm.get(r.resource_id).versions.push({
      effective: r.effective_month,
      team: r.team_id || "",
      lead: r.leader_name || "",
      status: r.status,
      included: !!r.included,
      start: r.start_date || (r.start_month ? r.start_month + "-01" : ""),
      end:
        r.end_date ||
        (r.end_month
          ? new Date(
              Date.UTC(
                Number(r.end_month.slice(0, 4)),
                Number(r.end_month.slice(5, 7)),
                0,
              ),
            )
              .toISOString()
              .slice(0, 10)
          : ""),
      amount: r.amount,
    });
  // Legacy IDs containing a composite separator retain complete-read semantics.
  const planningTeams =
    viewUser &&
    viewUser.role !== "admin" &&
    !d.teams.some((t) => t.id.includes("|"))
      ? [...visibleTeamScope(d, viewUser).ids]
      : undefined;
  d.allocations = await readCompositeMap(
    c,
    provider,
    "allocations",
    "amount",
    planningTeams,
  );
  d.actualAllocations = await readCompositeMap(
    c,
    provider,
    "actual_allocations",
    "amount",
  );
  d.actualWorkedHours = await readCompositeMap(
    c,
    provider,
    "actual_worked_hours",
    "hours",
  );
  d.actualPercentEntries = await readCompositeMap(
    c,
    provider,
    "actual_percent_entries",
    "percent",
  );
  d.revisions = await readRevisionMap(
    c,
    provider,
    viewUser?.role === "normal" ? [] : planningTeams,
  );
  return { data: d, generation: Number(s.generation) };
}
