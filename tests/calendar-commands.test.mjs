import test from "node:test";
import assert from "node:assert/strict";
import {
  startCalendarDraft,
  addCalendarDates,
  prepareCalendarChange,
  preparePersonalDayChange,
  preparePersonalDayRemoval,
} from "../frontend/src/features/calendar-commands.ts";
import { applyChanges } from "../backend/operations.mjs";

const admin = { role: "admin", _id: "admin", leaders: [] };
const owner = { role: "normal", _id: "owner", resourceId: "r", leaders: [] };
const day = { type: "company", label: "Tatil", fraction: 1 };
const fixture = () => ({
  teams: [{ id: "t", name: "Takım", lead: "A", excelCapacity: 0 }],
  projects: [],
  resources: [
    {
      id: "r",
      name: "Çalışan",
      note: "",
      versions: [
        {
          effective: "2026-01",
          team: "t",
          lead: "A",
          status: "Aktif Çalışan",
          included: true,
          start: "2026-01-01",
          end: "",
          amount: 1,
        },
      ],
    },
  ],
  allocations: {},
  workCalendar: { "2026-01-01": { ...day } },
  personCalendar: {},
  revisions: { "calendar:shared": 3 },
  leaders: ["A"],
  catalogVersion: 2,
});
const range = (from, to = "") => ({
  from,
  to,
  type: "official",
  fraction: 0.5,
  label: "",
});
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("calendar drafts keep their opening revision after background refresh and prevent lost updates", () => {
  const data = fixture();
  const draft = addCalendarDates(
    startCalendarDraft(freeze(structuredClone(data))),
    range("2026-01-02"),
  );
  applyChanges(data, admin, [
    {
      kind: "calendar",
      id: "shared",
      value: { "2026-01-05": day },
      revision: 3,
    },
  ]);
  const before = structuredClone(data);
  // The previous editor used the latest revision with its old draft, bypassing the conflict.
  const oldBehavior = structuredClone(data);
  applyChanges(oldBehavior, admin, [
    {
      ...prepareCalendarChange(draft),
      revision: data.revisions["calendar:shared"],
    },
  ]);
  assert.equal(oldBehavior.workCalendar["2026-01-05"], undefined);
  assert.throws(
    () => applyChanges(data, admin, [prepareCalendarChange(draft)]),
    (error) => error.status === 409,
  );
  assert.deepEqual(data, before);
  assert.equal(draft.revision, 3);
  assert.equal(draft.calendar["2026-01-01"].label, "Tatil");
  const command = prepareCalendarChange(draft);
  command.value["2026-01-01"].label = "changed";
  assert.equal(draft.calendar["2026-01-01"].label, "Tatil");
});

test("calendar ranges preserve other years, use inclusive dates and support leap days and the 62-day boundary", () => {
  const draft = freeze(startCalendarDraft(fixture()));
  const added = addCalendarDates(draft, range("2023-12-31", "2024-03-01"));
  assert.equal(Object.keys(added.calendar).length, 63);
  assert.deepEqual(added.calendar["2024-02-29"], {
    type: "official",
    label: "Resmî Tatil",
    fraction: 0.5,
  });
  assert.deepEqual(added.calendar["2026-01-01"], day);
  assert.equal(Object.keys(draft.calendar).length, 1);
  assert.throws(
    () => addCalendarDates(draft, range("2023-12-31", "2024-03-02")),
    /62 günlük/,
  );
  const single = addCalendarDates(draft, {
    ...range("2026-01-02"),
    label: "  Tek gün  ",
  });
  assert.equal(single.calendar["2026-01-02"].label, "Tek gün");
});

test("invalid calendar ranges fail before changing the draft", () => {
  const draft = freeze(startCalendarDraft(fixture()));
  for (const [input, message] of [
    [range("2026-02-29"), /Geçerli başlangıç/],
    [range("1999-12-31"), /Geçerli başlangıç/],
    [range("2200-01-01"), /Geçerli başlangıç/],
    [range("2026-01-02", "2026-01-01"), /başlangıçtan önce/],
    [{ ...range("2026-01-02"), label: "x".repeat(101) }, /100 karakter/],
  ])
    assert.throws(() => addCalendarDates(draft, input), message);
  assert.deepEqual(draft.calendar, { "2026-01-01": day });
});

test("personal commands preserve legacy keys and add independent same-day training without changing the source", () => {
  const data = fixture();
  data.personCalendar["r|2026-01-05"] = { type: "leave", hours: 2, label: "" };
  data.revisions["personDay:r|2026-01-05"] = 4;
  const before = structuredClone(data);
  const leave = preparePersonalDayChange(freeze(structuredClone(data)), "r", {
    date: "2026-01-05",
    type: "leave",
    hours: "2,5",
    label: "  İzin  ",
  });
  const training = preparePersonalDayChange(data, "r", {
    date: "2026-01-05",
    type: "training",
    hours: "3",
    label: "",
  });
  assert.equal(leave.id, "r|2026-01-05");
  assert.equal(leave.revision, 4);
  assert.equal(leave.value.label, "İzin");
  assert.equal(training.id, "r|2026-01-05|training");
  assert.deepEqual(data, before);
  applyChanges(data, owner, [leave, training]);
  assert.equal(data.personCalendar[leave.id].hours, 2.5);
  assert.equal(data.personCalendar[training.id].hours, 3);
});

test("personal commands validate real dates and half-hour steps while server retains ownership and daily-total checks", () => {
  const data = fixture();
  const input = { date: "2026-01-05", type: "leave", hours: "2", label: "" };
  for (const hours of ["", "NaN", "Infinity", "0", "-1", "0,25", "9,5"])
    assert.throws(
      () => preparePersonalDayChange(data, "r", { ...input, hours }),
      /yarım saatlik/,
    );
  assert.throws(
    () => preparePersonalDayChange(data, "r", { ...input, date: "2026-04-31" }),
    /geçerli tarih/,
  );
  assert.throws(
    () => preparePersonalDayChange(data, "missing", input),
    /Çalışan kaynak bulunamadı/,
  );
  const command = preparePersonalDayChange(data, "r", input);
  assert.throws(
    () =>
      applyChanges(structuredClone(data), { ...owner, resourceId: "other" }, [
        command,
      ]),
    (error) => error.status === 403,
  );
  const training = preparePersonalDayChange(data, "r", {
    ...input,
    type: "training",
    hours: "9",
  });
  assert.throws(
    () => applyChanges(structuredClone(data), owner, [command, training]),
    /9|günlük/i,
  );
});

test("personal removal deletes only the selected type and rejects missing, foreign and stale records", () => {
  const data = fixture();
  const input = { date: "2026-01-05", type: "leave", hours: "2", label: "" };
  applyChanges(data, owner, [
    preparePersonalDayChange(data, "r", input),
    preparePersonalDayChange(data, "r", { ...input, type: "training" }),
  ]);
  const id = "r|2026-01-05|leave";
  const command = preparePersonalDayRemoval(
    freeze(structuredClone(data)),
    "r",
    id,
  );
  assert.equal(command.revision, 1);
  assert.throws(
    () => preparePersonalDayRemoval(data, "other", id),
    /kaydı bulunamadı/,
  );
  assert.throws(
    () => preparePersonalDayRemoval(data, "r", "r|2026-01-06|leave"),
    /kaydı bulunamadı/,
  );
  applyChanges(data, owner, [command]);
  assert.equal(data.personCalendar[id], undefined);
  assert.equal(data.personCalendar["r|2026-01-05|training"].hours, 2);
  assert.throws(
    () => applyChanges(data, owner, [command]),
    (error) => error.status === 409,
  );
});
