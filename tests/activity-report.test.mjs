import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityRows,
  activityValue,
} from "../frontend/src/features/activity-report/activity-report-data.ts";
import { scopeData } from "../shared/access.ts";
const teams = [
  { id: "t-b", name: "Zırh", lead: "B Liderliği" },
  { id: "t-a2", name: "Şasi", lead: "A Liderliği" },
  { id: "t-a1", name: "Aktarma", lead: "A Liderliği" },
];
const projects = [{ id: "p1" }, { id: "p2" }];
const version = (team = "t-a1", patch = {}) => ({
  effective: "2026-01",
  start: "2026-01-01",
  end: "",
  team,
  lead: teams.find((t) => t.id === team)?.lead || "",
  status: "Aktif Çalışan",
  included: true,
  amount: 1,
  ...patch,
});
const person = (id, name, versions) => ({ id, name, note: "", versions });
const fixture = () => ({
  teams,
  projects,
  leaders: ["A Liderliği", "B Liderliği"],
  resources: [person("a", "Çetin", [version()])],
  allocations: {},
  actualAllocations: { "a|p1|2026-01": 0.5, "a|p2|2026-01": 0.25 },
  revisions: {},
});
const rows = (data, months = ["2026-01"], selected = projects) =>
  buildActivityRows(data, teams, selected, months, "2026-10");

test("activity report sorts leadership, then teams, then Turkish employee names", () => {
  const data = fixture();
  data.resources = [
    person("z", "Zeynep", [version("t-a1")]),
    person("b", "Ayşe", [version("t-b")]),
    person("s", "Ali", [version("t-a2")]),
    person("a", "Çetin", [version()]),
  ];
  assert.deepEqual(
    rows(data).map((r) => r.resourceId),
    ["a", "z", "s", "b"],
  );
});

test("activity units reuse actual capacity, leave, holidays and training; projects filter only project activities", () => {
  const data = fixture();
  data.workCalendar = {
    "2026-01-01": { type: "official", label: "Synthetic holiday", fraction: 1 },
  };
  data.personCalendar = {
    "a|2026-01-02|leave": { type: "leave", hours: 9, label: "" },
    "a|2026-01-05|training": { type: "training", hours: 9, label: "" },
  };
  data.actualWorkedHours = { "a|2026-01": 180 };
  const cell = rows(data)[0].cells[0];
  assert.equal(cell.effectiveHours, 162);
  assert.equal(activityValue(cell, "hours"), 144);
  assert.equal(activityValue(cell, "days"), 16);
  assert.equal(activityValue(cell, "percent"), (144 / 162) * 100);
  assert.ok(
    Math.abs(
      activityValue(
        rows(data, ["2026-01"], [projects[0]])[0].cells[0],
        "hours",
      ) - 99,
    ) < 1e-9,
  );
  assert.equal(
    activityValue(rows(data, ["2026-01"], [])[0].cells[0], "hours"),
    9,
  );
});

test("before-start and departure labels preserve historical entries including the departure month", () => {
  const data = fixture();
  data.resources = [
    person("a", "Çetin", [
      version("t-a1", { start: "2026-02-10", end: "2026-04-15" }),
      version("t-a1", {
        effective: "2026-04",
        start: "2026-02-10",
        end: "2026-04-15",
        status: "İşten Ayrıldı",
      }),
    ]),
  ];
  data.actualAllocations = { "a|p1|2026-01": 0.5, "a|p1|2026-04": 0.25 };
  const cells = rows(data, ["2026-01", "2026-02", "2026-04", "2026-05"])[0]
    .cells;
  assert.deepEqual(
    cells.map((c) => c.state),
    ["before-start", "working", "departed", "departed"],
  );
  assert.equal(activityValue(cells[0], "hours"), 90);
  assert.equal(activityValue(cells[2], "hours"), 45);
  assert.equal(activityValue(cells[3], "hours"), null);
});

test("transfers report each month under its historical team without duplicating totals", () => {
  const data = fixture();
  data.resources = [
    person("a", "Çetin", [version(), version("t-b", { effective: "2026-02" })]),
  ];
  data.actualAllocations["a|p1|2026-02"] = 1;
  const result = rows(data, ["2026-01", "2026-02"]);
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((r) => r.cells.map((c) => c.totalFte)),
    [
      [0.75, 0],
      [0, 1],
    ],
  );
  assert.equal(result[0].cells[1].state, "other-team");
});

test("zero capacity, future months and rehiring do not fabricate percentages or departure labels", () => {
  const data = fixture();
  data.actualWorkedHours = { "a|2026-01": 0 };
  data.actualAllocations["a|p1|2026-11"] = 1;
  data.resources[0].versions.push(
    version("t-a1", {
      effective: "2026-02",
      status: "İşten Ayrıldı",
      end: "2026-02-01",
    }),
    version("t-a1", { effective: "2026-03", start: "2026-03-01", end: "" }),
  );
  const cells = rows(data, ["2026-01", "2026-02", "2026-03", "2026-11"])[0]
    .cells;
  assert.equal(activityValue(cells[0], "percent"), null);
  assert.equal(activityValue(cells[0], "hours"), 135);
  assert.equal(cells[1].state, "departed");
  assert.equal(cells[2].state, "working");
  assert.equal(cells[3].state, "future");
  assert.equal(activityValue(cells[3], "hours"), null);
});

test("API-scoped manager and normal snapshots retain only permitted named rows and values", () => {
  const data = fixture();
  data.resources.push(person("b", "Private colleague", [version("t-b")]));
  data.actualAllocations["b|p1|2026-01"] = 1;
  const manager = scopeData(data, {
    id: "m",
    role: "manager",
    leaders: ["A Liderliği"],
    resourceId: "",
  });
  assert.deepEqual(
    buildActivityRows(
      manager,
      manager.teams,
      projects,
      ["2026-01"],
      "2026-10",
    ).map((r) => r.resourceId),
    ["a"],
  );
  const normal = scopeData(data, {
    id: "n",
    role: "normal",
    leaders: ["A Liderliği"],
    resourceId: "a",
  });
  assert.deepEqual(
    buildActivityRows(
      normal,
      normal.teams,
      projects,
      ["2026-01"],
      "2026-10",
      "a",
    ).map((r) => r.resourceId),
    ["a"],
  );
  assert.equal(
    buildActivityRows(
      normal,
      normal.teams,
      projects,
      ["2026-01"],
      "2026-10",
      "",
    ).length,
    0,
  );
});
