import test from "node:test";
import assert from "node:assert/strict";
import {
  orderedPlanningUnits,
  planningUnitHierarchy,
  selectedLeadershipScope,
} from "../shared/leadership-planning.ts";
import {
  selectWorkspaceScope,
  selectWorkspacePages,
} from "../frontend/src/features/workspace/workspace-selectors.ts";
const unit = (id, lead, kind) => ({
  id,
  name: id,
  lead,
  ...(kind ? { kind } : {}),
  excelCapacity: 0,
});
const data = {
  leaders: ["Root", "Other", "Zulu Child", "Alpha Grandchild"],
  leaderParents: { "Zulu Child": "Root", "Alpha Grandchild": "Zulu Child" },
  leadershipUnits: {
    Root: "root",
    Other: "other",
    "Zulu Child": "child",
    "Alpha Grandchild": "grand",
  },
  teams: [
    unit("rt", "Root"),
    unit("grand", "Alpha Grandchild", "leadership"),
    unit("other", "Other", "leadership"),
    unit("ct", "Zulu Child"),
    unit("child", "Zulu Child", "leadership"),
    unit("root", "Root", "leadership"),
    unit("gt", "Alpha Grandchild"),
    unit("orphan", ""),
  ],
  resources: [],
  projects: [{ id: "p", name: "P", start: "2026-01", end: "2026-12" }],
  allocations: {},
  revisions: {},
};
const filters = {
  leads: [],
  teamIds: [],
  projectIds: [],
  start: "2026-01",
  months: ["2026-01"],
  currentMonth: "2026-01",
};
test("planning hierarchy: parent, child, grandchild stay together despite alphabetic order; owners remain unique", () => {
  const before = structuredClone(data),
    rows = orderedPlanningUnits(data, data.teams);
  assert.deepEqual(
    rows.map((t) => t.id),
    ["orphan", "other", "root", "child", "grand", "gt", "ct", "rt"],
  );
  assert.equal(new Set(rows.map((t) => t.id)).size, data.teams.length);
  assert.deepEqual(data, before);
  assert.deepEqual(
    planningUnitHierarchy(
      data,
      rows.find((t) => t.id === "child"),
    ),
    { parent: "Root", depth: 1 },
  );
  assert.equal(
    planningUnitHierarchy(
      data,
      rows.find((t) => t.id === "gt"),
    ).depth,
    3,
  );
});
test("planning hierarchy: filter gaps do not synthesize parent rows or allocations", () => {
  const selected = data.teams.filter((t) => ["grand", "ct"].includes(t.id));
  assert.deepEqual(
    orderedPlanningUnits(data, selected).map((t) => t.id),
    ["grand", "ct"],
  );
});
test("planning hierarchy: all workspace leadership filters include descendants; explicit team filters remain available", () => {
  const expanded = selectWorkspaceScope(
    data,
    { role: "admin", leaders: [] },
    { ...filters, leads: ["Root"] },
  );
  assert.deepEqual(expanded.ids, ["root", "child", "grand", "gt", "ct", "rt"]);
  assert.equal(expanded.leaderReportGroups.length, 1);
  assert.deepEqual(
    selectWorkspaceScope(data, null, { ...filters, leads: ["Root"] }).ids,
    ["root", "child", "grand", "gt", "ct", "rt"],
  );
  assert.deepEqual(
    selectWorkspaceScope(data, null, {
      ...filters,
      leads: ["Root"],
      teamIds: ["grand"],
    }).ids,
    ["grand"],
  );
  assert.deepEqual(
    [...selectedLeadershipScope(data, ["Zulu Child"], true)],
    ["Zulu Child", "Alpha Grandchild"],
  );
});
test("planning hierarchy: both table views and selected cell keys use the same stable owner order", () => {
  const scope = selectWorkspaceScope(data, null, {
    ...filters,
    leads: ["Root"],
  });
  for (const view of ["team", "project"]) {
    const page = selectWorkspacePages(scope.teams, data.projects, {
      count: 12,
      view,
      planPage: 0,
      projectPage: 0,
    });
    assert.deepEqual(
      page.visiblePlanRows,
      scope.ids.map((id) => id + "|p"),
    );
  }
});
test("planning hierarchy: partial authorized snapshot cannot introduce absent units; invalid cycles terminate", () => {
  const restricted = {
    ...data,
    teams: data.teams.filter((t) => t.lead === "Zulu Child"),
  };
  const scope = selectWorkspaceScope(
    restricted,
    { role: "manager", leaders: ["Zulu Child"] },
    { ...filters, leads: ["Root"] },
  );
  assert.deepEqual(scope.ids, ["child", "ct"]);
  const cycle = {
    ...data,
    leaderParents: { Root: "Zulu Child", "Zulu Child": "Root" },
  };
  assert.equal(
    orderedPlanningUnits(cycle, data.teams).length,
    data.teams.length,
  );
  assert(
    planningUnitHierarchy(
      cycle,
      data.teams.find((t) => t.id === "root"),
    ).depth <= data.leaders.length,
  );
});

test("leadership filters expose all authorized leaderships and team filters omit leadership capacity owners", () => {
  const scope = selectWorkspaceScope(data, null, filters);
  assert.deepEqual(
    scope.leaderFilterItems.map((x) => x.id),
    data.leaders,
  );
  assert.deepEqual(
    scope.leaderItems.map((x) => x.id),
    data.leaders,
  );
  assert(scope.availableTeams.every((team) => team.kind !== "leadership"));
  assert(scope.teams.some((team) => team.kind === "leadership"));
  const selectedChild = selectWorkspaceScope(data, null, {
    ...filters,
    leads: ["Zulu Child"],
  });
  assert.deepEqual(selectedChild.ids, ["child", "grand", "gt", "ct"]);
  assert.deepEqual(
    selectedChild.availableTeams.map((team) => team.id),
    ["ct", "gt"],
  );
  const selectedTeam = selectWorkspaceScope(data, null, {
    ...filters,
    teamIds: ["ct"],
  });
  assert.deepEqual(selectedTeam.ids, ["ct"]);
  const restricted = {
    ...data,
    leaders: ["Alpha Grandchild"],
    teams: data.teams.filter((t) => t.lead === "Alpha Grandchild"),
  };
  const childScope = selectWorkspaceScope(
    restricted,
    { role: "manager", leaders: ["Alpha Grandchild"] },
    { ...filters, leads: ["Root"] },
  );
  assert.deepEqual(
    childScope.leaderFilterItems.map((x) => x.id),
    ["Alpha Grandchild"],
  );
  assert.deepEqual(childScope.ids, ["grand", "gt"]);
  assert.deepEqual(
    childScope.leaderItems.map((x) => x.id),
    ["Alpha Grandchild"],
  );
});
