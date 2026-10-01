import test from "node:test";
import assert from "node:assert/strict";
import { prepareTimelineChange } from "../frontend/src/features/project-timeline-commands.ts";
import { milestoneRanges } from "../shared/milestone-ranges.ts";
import { applyChanges } from "../backend/operations.mjs";
import { validate } from "../shared/server-domain.ts";
const admin = { _id: "root-admin", role: "admin", leaders: [] };
const fixture = () => ({
  teams: [{ id: "t", name: "Takım", lead: "L", excelCapacity: 0 }],
  resources: [],
  leaders: ["L"],
  allocations: {},
  revisions: { "project:p": 3 },
  projects: [
    {
      id: "p",
      name: "Proje",
      responsibleName: "Güncel sorumlu",
      phases: { "2026-10": "Güncel aşama" },
      start: "2026-01",
      end: "2026-12",
      milestones: [
        {
          id: "m",
          name: "Kritik konu",
          start: "2026-10-10",
          end: "2026-10-20",
          barStyle: "outline",
          barColor: "blue",
          hasCriticalTopics: true,
          barNotes: [
            {
              text: "Detay",
              start: "2026-10-12",
              end: "2026-10-18",
              completed: true,
              includeInReport: true,
            },
          ],
        },
        {
          id: "other",
          name: "Diğer konu",
          start: "2026-12-01",
          end: "2026-12-03",
          hasCriticalTopics: true,
          barNotes: [{ text: "Diğer detay", includeInReport: false }],
        },
      ],
    },
  ],
});
function save(data, adjustment) {
  const before = structuredClone(data);
  const command = prepareTimelineChange(data, "p", "m", adjustment);
  assert.deepEqual(data, before, "command preparation must not mutate source");
  applyChanges(data, admin, [command]);
  validate(data);
  return { command, range: milestoneRanges(data.projects[0].milestones[0])[0] };
}

test("moving a bar shifts its notes and preserves project fields, flags and other topics", () => {
  const data = fixture();
  const other = structuredClone(data.projects[0].milestones[1]);
  const { command, range } = save(data, {
    target: "range",
    rangeIndex: 0,
    mode: "move",
    days: -2,
  });
  assert.equal(command.revision, 3);
  assert.deepEqual([range.start, range.end], ["2026-10-08", "2026-10-18"]);
  assert.deepEqual(
    [range.notes[0].start, range.notes[0].end],
    ["2026-10-10", "2026-10-16"],
  );
  assert.equal(range.notes[0].completed, true);
  assert.equal(range.notes[0].includeInReport, true);
  assert.deepEqual(data.projects[0].milestones[1], other);
  assert.equal(data.projects[0].responsibleName, "Güncel sorumlu");
  assert.equal(data.projects[0].phases["2026-10"], "Güncel aşama");
});
test("resizing either end adjusts the same end of the parent and detail by calendar days", () => {
  for (const [mode, days, dates] of [
    ["start", -3, ["2026-10-07", "2026-10-20", "2026-10-09", "2026-10-18"]],
    ["end", 3, ["2026-10-10", "2026-10-23", "2026-10-12", "2026-10-21"]],
  ]) {
    const { range } = save(fixture(), {
      target: "range",
      rangeIndex: 0,
      mode,
      days,
    });
    assert.deepEqual(
      [range.start, range.end, range.notes[0].start, range.notes[0].end],
      dates,
    );
  }
});
test("detail changes expand the parent only when needed and preserve manually wider dates", () => {
  const data = fixture();
  const { range } = save(data, {
    target: "note",
    rangeIndex: 0,
    noteIndex: 0,
    mode: "end",
    days: 1,
  });
  assert.deepEqual([range.start, range.end], ["2026-10-10", "2026-10-20"]);
  const next = save(data, {
    target: "note",
    rangeIndex: 0,
    noteIndex: 0,
    mode: "start",
    days: -5,
  }).range;
  assert.deepEqual(
    [next.start, next.end, next.notes[0].start],
    ["2026-10-07", "2026-10-20", "2026-10-07"],
  );
});
test("timeline edits reject overlaps, invalid narrowing and project boundary violations", () => {
  const data = fixture();
  data.projects[0].milestones[0].additionalRanges = [
    {
      start: "2026-10-25",
      end: "2026-10-28",
      notes: [{ text: "İkinci aralık", includeInReport: true }],
    },
  ];
  const before = structuredClone(data);
  for (const [adjustment, message] of [
    [
      { target: "range", rangeIndex: 0, mode: "move", days: 10 },
      /diğer kritik tarihlerin/,
    ],
    [
      { target: "range", rangeIndex: 0, mode: "end", days: -8 },
      /Bar daraltılamıyor/,
    ],
    [{ target: "range", rangeIndex: 0, mode: "move", days: -365 }, /proje/],
  ])
    assert.throws(
      () => prepareTimelineChange(data, "p", "m", adjustment),
      message,
    );
  assert.deepEqual(data, before);
});
test("timeline commands retain conflict checks and explain a removed project or topic", () => {
  const data = fixture();
  const adjustment = { target: "range", rangeIndex: 0, mode: "move", days: 1 };
  const command = prepareTimelineChange(data, "p", "m", adjustment);
  applyChanges(data, admin, [command]);
  assert.throws(
    () => applyChanges(data, admin, [command]),
    (error) => error.status === 409,
  );
  for (const [projectId, topicId] of [
    ["missing", "m"],
    ["p", "missing"],
  ])
    assert.throws(
      () => prepareTimelineChange(data, projectId, topicId, adjustment),
      /Kritik konu bulunamadı/,
    );
});
