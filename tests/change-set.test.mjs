import test from "node:test";
import assert from "node:assert/strict";
import { dataChanges, recordChanges } from "../backend/change-set.mjs";
import { auditEntries } from "../backend/audit.mjs";

const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test("record changes distinguish zero, deletion and creation using own values for prototype-like keys", () => {
  const before = freeze(
    Object.fromEntries([
      ["same", 0],
      ["removed", 0],
      ["updated", 0.25],
      ["constructor", { id: "constructor", name: "Old" }],
    ]),
  );
  const after = freeze(
    Object.fromEntries([
      ["same", 0],
      ["updated", 0.5],
      ["created", 0],
      ["toString", { id: "toString", name: "New" }],
    ]),
  );
  assert.deepEqual(recordChanges(before, after), [
    { id: "removed", before: 0, value: undefined },
    { id: "updated", before: 0.25, value: 0.5 },
    { id: "constructor", before: before.constructor, value: undefined },
    { id: "created", before: undefined, value: 0 },
    { id: "toString", before: undefined, value: after.toString },
  ]);
  assert.deepEqual(recordChanges(after, structuredClone(after)), []);
});

test("full snapshot changes include nested/cascading data and calendar maps but revision-only changes do not create record edits", () => {
  const before = freeze({
    teams: [{ id: "t", name: "Team", lead: "A" }],
    projects: [{ id: "p", name: "Project" }],
    resources: [
      {
        id: "r",
        name: "Person",
        versions: [{ team: "t", lead: "A", end: "" }],
      },
    ],
    risks: [],
    leaders: ["A"],
    leaderManagers: {},
    allocations: { "t|p|2026-09": 0.5 },
    actualAllocations: { "r|p|2026-09": 0.25 },
    actualWorkedHours: { "r|2026-09": 180 },
    actualPercentEntries: { "r|p|2026-09": 25 },
    workCalendar: {},
    personCalendar: {},
    revisions: { "resource:r": 1 },
  });
  const after = structuredClone(before);
  after.teams[0].lead = "B";
  after.resources[0].versions[0].lead = "B";
  after.resources[0].versions[0].end = "2026-09-30";
  after.leaders.push("B", "constructor");
  after.leaderManagers.B = "Manager";
  delete after.allocations["t|p|2026-09"];
  after.actualAllocations["r|p|2026-09"] = 0.5;
  after.actualWorkedHours["r|2026-09"] = 200;
  after.actualPercentEntries["r|p|2026-09"] = 45;
  after.workCalendar["2026-09-01"] = {
    type: "company",
    fraction: 0.5,
    label: "Half day",
  };
  after.personCalendar["r|2026-09-02|leave"] = {
    type: "leave",
    hours: 2,
    label: "Private",
  };
  after.revisions["resource:r"]++;
  freeze(after);
  const changes = dataChanges(before, after);
  for (const kind of [
    "team",
    "resource",
    "allocation",
    "actual",
    "workedHours",
    "percent",
    "calendar",
    "personDay",
  ])
    assert.equal(changes[kind].length, 1);
  assert.deepEqual(changes.project, []);
  assert.deepEqual(changes.risk, []);
  assert.deepEqual(changes.resource[0].before.versions[0], {
    team: "t",
    lead: "A",
    end: "",
  });
  assert.deepEqual(changes.resource[0].value.versions[0], {
    team: "t",
    lead: "B",
    end: "2026-09-30",
  });
  assert.deepEqual(
    changes.leader.map(({ value }) => value),
    [
      { name: "B", managerName: "Manager" },
      { name: "constructor", managerName: "" },
    ],
  );
  const revisionsOnly = { ...before, revisions: { "resource:r": 2 } };
  assert(
    Object.values(dataChanges(before, revisionsOnly)).every(
      (items) => items.length === 0,
    ),
  );
});

test("audit consumes supplied changed records without scanning the full allocation maps", () => {
  const blocked = new Proxy(
    {},
    {
      ownKeys() {
        throw Error("Full allocation scan");
      },
    },
  );
  const base = {
    teams: [{ id: "t", name: "Team" }],
    projects: [{ id: "p", name: "Project" }],
    resources: [],
    risks: [],
    leaders: [],
    allocations: {},
    actualAllocations: {},
  };
  const after = { ...base, allocations: { "t|p|2026-09": 0.5 } };
  const changeSet = dataChanges(base, after);
  const events = auditEntries(
    { ...base, allocations: blocked },
    { ...after, allocations: blocked },
    { _id: "admin", name: "Admin" },
    { changeSet },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "create");
  assert.equal(events[0].record_name, "Team · Project · 2026-09");
  assert.deepEqual(JSON.parse(events[0].changes), [
    { path: [], before: null, after: 0.5 },
  ]);
});
