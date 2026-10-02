import test from "node:test";
import assert from "node:assert/strict";
import {
  createPersonMonthHoursIndex,
  personMonthHours,
  DEFAULT_MONTHLY_HOURS,
} from "../shared/actual-units.ts";
import { stageChanges } from "../backend/operations.mjs";
import { validate } from "../shared/server-domain.ts";

const fixture = () => ({
  teams: [{ id: "t", name: "Team", lead: "L", excelCapacity: 0 }],
  projects: ["p", "q"].map((id) => ({
    id,
    name: id,
    start: "2000-01",
    end: "2199-12",
    phases: {},
  })),
  resources: ["r", "s"].map((id) => ({
    id,
    name: id,
    note: "",
    versions: [
      {
        effective: "2026-01",
        team: "t",
        lead: "L",
        status: "Aktif Çalışan",
        included: true,
        start: "2026-01-01",
        end: "",
        amount: 1,
      },
    ],
  })),
  leaders: ["L"],
  allocations: {},
  actualAllocations: {},
  actualPercentEntries: {},
  actualWorkedHours: {},
  revisions: { "calendar:shared": 1 },
  workCalendar: {
    "2026-01-01": { type: "official", label: "Holiday", fraction: 1 },
    "2026-01-02": { type: "company", label: "Half day", fraction: 0.5 },
    "2026-01-03": { type: "religious", label: "Weekend", fraction: 1 },
  },
  personCalendar: {
    "r|2026-01-02": { type: "leave", hours: 1.5, label: "" },
    "r|2026-01-02|training": { type: "training", hours: 5, label: "" },
    "r|2026-01-05|leave": { type: "leave", hours: 2, label: "" },
    "r|2026-01-03|training": { type: "training", hours: 9, label: "" },
  },
});

test("person-month index matches direct holiday/leave/training/overtime calculations across date boundaries", () => {
  const data = fixture();
  for (const month of ["2000-02", "2026-01", "2026-02", "2028-02", "2199-12"]) {
    data.actualWorkedHours["r|" + month] = 230;
    data.actualWorkedHours["s|" + month] = 0;
  }
  const before = structuredClone(data),
    index = createPersonMonthHoursIndex(data);
  for (const resource of ["r", "s", "other", "constructor", "__proto__"])
    for (const month of ["2000-02", "2026-01", "2026-02", "2028-02", "2199-12"])
      assert.deepEqual(
        index.get(resource, month),
        personMonthHours(
          month,
          resource,
          data.actualWorkedHours[resource + "|" + month],
          data.workCalendar,
          data.personCalendar,
        ),
      );
  assert.deepEqual(data, before);
  assert.equal(index.get("r", "2026-01").trainingHours, 3);
  assert.equal(index.get("s", "2026-01").effectiveHours, 0);
});

test("index computes each requested month once, including automatic and zero hours; fresh snapshots get fresh totals", () => {
  const data = fixture();
  data.actualWorkedHours["s|2026-02"] = 0;
  const reads = [];
  data.actualWorkedHours = new Proxy(data.actualWorkedHours, {
    get(target, key) {
      reads.push(key);
      return target[key];
    },
  });
  const index = createPersonMonthHoursIndex(data);
  const automatic = index.get("r", "2026-02"),
    zero = index.get("s", "2026-02");
  for (let i = 0; i < 20; i++) {
    assert.strictEqual(index.get("r", "2026-02"), automatic);
    assert.strictEqual(index.get("s", "2026-02"), zero);
  }
  assert.deepEqual(reads, ["r|2026-02", "s|2026-02"]);
  const changed = fixture();
  changed.personCalendar["r|2026-02-02|leave"] = {
    type: "leave",
    hours: 2,
    label: "",
  };
  assert.equal(
    createPersonMonthHoursIndex(changed).get("r", "2026-02").effectiveHours,
    automatic.effectiveHours - 2,
  );
  assert.equal(
    index.get("r", "2026-02").effectiveHours,
    automatic.effectiveHours,
  );
});

test("calendar batch scans percentages once and changes only affected months, preserving stored project hours", () => {
  const data = fixture();
  for (const resource of data.resources)
    for (const month of ["2026-01", "2026-02"])
      for (const project of data.projects) {
        const key = resource.id + "|" + project.id + "|" + month;
        const hours = personMonthHours(
          month,
          resource.id,
          undefined,
          data.workCalendar,
          data.personCalendar,
        );
        data.actualAllocations[key] =
          (hours.effectiveHours * 0.1) / DEFAULT_MONTHLY_HOURS;
        data.actualPercentEntries[key] = 10;
        data.revisions["actual:" + key] = 1;
      }
  const before = structuredClone(data);
  let scans = 0;
  data.actualPercentEntries = new Proxy(data.actualPercentEntries, {
    ownKeys(target) {
      scans++;
      return Reflect.ownKeys(target);
    },
  });
  stageChanges(data, { role: "admin", _id: "a", leaders: [] }, [
    {
      kind: "calendar",
      id: "shared",
      revision: 1,
      value: {
        ...data.workCalendar,
        "2026-01-01": {
          type: "official",
          label: "Half holiday",
          fraction: 0.5,
        },
      },
    },
  ]);
  assert.equal(scans, 1);
  assert.deepEqual(data.actualAllocations, before.actualAllocations);
  for (const [key, percent] of Object.entries(data.actualPercentEntries)) {
    const [resource, , month] = key.split("|");
    if (month === "2026-02") {
      assert.equal(percent, 10);
      assert.equal(data.revisions["actual:" + key], 1);
    } else {
      const hours = personMonthHours(
        month,
        resource,
        undefined,
        data.workCalendar,
        data.personCalendar,
      );
      assert.equal(
        percent,
        ((data.actualAllocations[key] * DEFAULT_MONTHLY_HOURS) /
          hours.effectiveHours) *
          100,
      );
      assert.equal(data.revisions["actual:" + key], 2);
    }
  }
  assert.doesNotThrow(() => validate(data));
});

test("final batch uses changed calendar and hours together, while empty scope never scans percentages", () => {
  const data = fixture();
  data.personCalendar = {};
  data.actualWorkedHours["r|2026-02"] = 180;
  data.actualAllocations["r|p|2026-02"] = 0.25;
  data.actualPercentEntries["r|p|2026-02"] = 25;
  data.revisions["actual:r|p|2026-02"] = 1;
  stageChanges(data, { role: "admin", _id: "a", leaders: [] }, [
    {
      kind: "calendar",
      id: "shared",
      revision: 1,
      value: {
        ...data.workCalendar,
        "2026-02-02": { type: "company", label: "Half day", fraction: 0.5 },
      },
    },
    { kind: "workedHours", id: "r|2026-02", revision: 0, value: 230 },
  ]);
  assert.equal(data.actualPercentEntries["r|p|2026-02"], (45 / 225.5) * 100);
  assert.doesNotThrow(() => validate(data));
  data.actualPercentEntries = new Proxy(data.actualPercentEntries, {
    ownKeys() {
      throw Error("Unrelated percentage scan");
    },
  });
  assert.doesNotThrow(() =>
    stageChanges(data, { role: "admin", _id: "a", leaders: [] }, [
      { kind: "allocation", id: "t|p|2026-02", revision: 0, value: 0.5 },
    ]),
  );
});
