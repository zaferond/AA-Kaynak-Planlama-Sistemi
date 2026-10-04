import test from "node:test";
import assert from "node:assert/strict";
import { captureEditorRevisions } from "../frontend/src/features/editor-revisions.ts";
import { prepareEditorChanges } from "../frontend/src/features/editor-commands.ts";
import { applyChanges } from "../backend/operations.mjs";
import { validate } from "../shared/server-domain.ts";
const context = { start: "2026-10", resourceIds: [] };
const admin = { _id: "root-admin", role: "admin", leaders: [] };
const version = {
  effective: "2026-01",
  team: "t",
  lead: "A",
  status: "Aktif Çalışan",
  included: true,
  start: "2026-01-01",
  end: "",
  amount: 1,
};
const fixture = () => ({
  teams: [
    { id: "t", name: "Takım", lead: "A", excelCapacity: 0, catalog: true },
    {
      id: "unassigned",
      name: "Eşleşmemiş",
      lead: "",
      excelCapacity: 0,
      catalog: true,
    },
  ],
  projects: [
    { id: "p", name: "Proje", start: "2026-01", end: "2026-12", phases: {} },
  ],
  resources: [
    { id: "r", name: "Çalışan", note: "", versions: [{ ...version }] },
  ],
  allocations: {},
  revisions: { "project:p": 4, "resource:r": 2 },
  leaders: ["A", "B"],
  catalogVersion: 2,
});
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const milestone = () => ({
  id: "m",
  name: "  Kritik Konu  ",
  start: "2026-10-10",
  end: "2026-10-20",
  barStyle: "outline",
  barNotes: [
    {
      text: "Detay",
      includeInReport: true,
      start: "2026-10-12",
      end: "2026-10-18",
    },
  ],
});

test("new topics append even with earlier dates; edits keep their existing row", () => {
  const data = fixture();
  const current = milestone();
  data.projects[0].milestones = [
    current,
    { ...structuredClone(current), id: "second", name: "Second" },
  ];
  const editor = {
    baseRevisions: captureEditorRevisions(data),
    kind: "milestone",
    projectId: "p",
    isNew: true,
    draftEmpty: true,
    value: {
      ...milestone(),
      id: "new",
      start: "2026-01-01",
      end: "2026-01-01",
    },
  };
  const saved = prepareEditorChanges(data, editor, context)[0].value;
  assert.deepEqual(
    saved.milestones.map((m) => m.id),
    ["m", "second", "new"],
  );
  const edited = prepareEditorChanges(
    { ...data, projects: [saved] },
    {
      ...editor,
      isNew: false,
      value: { ...current, name: "Changed" },
    },
    context,
  )[0].value;
  assert.deepEqual(
    edited.milestones.map((m) => m.id),
    ["m", "second", "new"],
  );
  assert.equal(edited.milestones[0].name, "Changed");
  assert.throws(
    () => prepareEditorChanges(data, { ...editor, isNew: false }, context),
    /bulunamadı/,
  );
});

test("editor prepares revision-aware project updates without changing the draft or source", () => {
  const data = freeze(fixture());
  const editor = freeze({
    baseRevisions: captureEditorRevisions(data),
    kind: "project",
    isNew: false,
    value: { ...data.projects[0], name: "Yeni ad" },
  });
  const changes = prepareEditorChanges(data, editor, context);
  assert.equal(changes[0].revision, 4);
  assert.equal(data.projects[0].name, "Proje");
  const saved = structuredClone(data);
  applyChanges(saved, admin, changes);
  validate(saved);
  assert.equal(saved.projects[0].name, "Yeni ad");
  assert.throws(
    () => applyChanges(saved, admin, changes),
    (error) => error.status === 409,
  );
});
test("phase editor rejects a month outside the project dates", () => {
  const data = fixture();
  const editor = {
    baseRevisions: captureEditorRevisions(data),
    kind: "projectPhase",
    value: data.projects[0],
    phaseMonth: "2027-01",
  };
  assert.throws(
    () => prepareEditorChanges(data, editor, context),
    /proje dönemi/,
  );
  assert.equal(
    prepareEditorChanges(data, { ...editor, phaseMonth: "2026-12" }, context)
      .length,
    1,
  );
});
test("critical topic preparation preserves enclosing dates and allows a topic with no notes", () => {
  const data = freeze(fixture());
  const editor = freeze({
    baseRevisions: captureEditorRevisions(data),
    kind: "milestone",
    projectId: "p",
    isNew: true,
    draftEmpty: false,
    value: milestone(),
  });
  const changes = prepareEditorChanges(data, editor, context);
  const saved = structuredClone(data);
  applyChanges(saved, admin, changes);
  validate(saved);
  const topic = saved.projects[0].milestones[0];
  assert.equal(topic.name, "Kritik Konu");
  assert.equal(topic.start, "2026-10-10");
  assert.equal(topic.end, "2026-10-20");
  assert.equal(topic.barNotes[0].includeInReport, true);
  const empty = prepareEditorChanges(
    data,
    { ...editor, draftEmpty: true },
    context,
  )[0].value.milestones[0];
  assert.equal(empty.hasCriticalTopics, false);
  assert.equal(data.projects[0].milestones, undefined);
});
test("critical topic preparation rejects missing projects and overlapping date ranges before saving", () => {
  const data = fixture();
  const editor = {
    baseRevisions: captureEditorRevisions(data),
    kind: "milestone",
    projectId: "p",
    isNew: true,
    draftEmpty: false,
    value: {
      ...milestone(),
      additionalRanges: [
        {
          start: "2026-10-15",
          end: "2026-10-25",
          notes: [{ text: "İkinci", includeInReport: true }],
        },
      ],
    },
  };
  assert.throws(
    () => prepareEditorChanges(data, editor, context),
    /diğer kritik tarihlerin/,
  );
  assert.throws(
    () =>
      prepareEditorChanges(data, { ...editor, projectId: "missing" }, context),
    /Proje bulunamadı/,
  );
});
test("new resource and team leadership are prepared as one valid batch", () => {
  const data = freeze(fixture());
  const editor = freeze({
    baseRevisions: captureEditorRevisions(data),
    kind: "resource",
    isNew: true,
    value: { id: "new", name: "Yeni çalışan", note: "", versions: [] },
    version: { ...version, team: "unassigned", start: "2026-04-12" },
  });
  const changes = prepareEditorChanges(data, editor, context);
  assert.deepEqual(
    changes.map((c) => c.kind),
    ["team", "resource"],
  );
  assert.equal(changes[1].value.versions[0].effective, "2026-04");
  const saved = structuredClone(data);
  applyChanges(saved, admin, changes);
  validate(saved);
  assert.equal(saved.teams.find((t) => t.id === "unassigned").lead, "A");
  assert.equal(data.teams[1].lead, "");
});
test("resource edits retain date and leadership checks and explain stale team selections", () => {
  const data = fixture();
  const editor = {
    baseRevisions: captureEditorRevisions(data),
    kind: "resource",
    isNew: false,
    value: data.resources[0],
    version,
  };
  for (const [patch, message] of [
    [{ start: "" }, /İşbaşı Tarihi/],
    [{ status: "İşten Ayrıldı", end: "" }, /iki|işten ayrılış/],
    [{ end: "2025-12-31" }, /önce olamaz/],
    [{ lead: "B" }, /bu liderliğe bağlı değil/],
    [{ team: "missing" }, /takım bulunamadı/],
  ])
    assert.throws(
      () =>
        prepareEditorChanges(
          data,
          { ...editor, version: { ...version, ...patch } },
          context,
        ),
      message,
    );
});
test("bulk resource edits preserve history, deduplicate selections and keep source data unchanged", () => {
  const data = fixture();
  data.resources[0].versions.push({
    ...version,
    effective: "2026-09",
    amount: 0.5,
  });
  freeze(data);
  const editor = freeze({
    baseRevisions: captureEditorRevisions(data),
    kind: "bulkResources",
    effective: "2026-10",
    team: "",
    lead: "",
    status: "",
    included: "no",
  });
  const changes = prepareEditorChanges(data, editor, {
    ...context,
    resourceIds: ["r", "r"],
  });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].revision, 2);
  const saved = structuredClone(data);
  applyChanges(saved, admin, changes);
  validate(saved);
  assert.deepEqual(
    saved.resources[0].versions.slice(0, 2),
    data.resources[0].versions,
  );
  assert.equal(saved.resources[0].versions[2].included, false);
  assert.equal(saved.resources[0].versions[2].amount, 0.5);
});
test("bulk resource edits fail clearly for removed selections without partially changing a team", () => {
  const data = freeze(fixture());
  const editor = {
    baseRevisions: captureEditorRevisions(data),
    kind: "bulkResources",
    effective: "2026-10",
    team: "unassigned",
    lead: "A",
    status: "",
    included: "keep",
  };
  assert.throws(
    () =>
      prepareEditorChanges(data, editor, {
        ...context,
        resourceIds: ["r", "missing"],
      }),
    /kaynak bulunamadı/,
  );
  assert.equal(data.teams[1].lead, "");
  assert.throws(
    () =>
      prepareEditorChanges(
        data,
        { ...editor, team: "missing" },
        { ...context, resourceIds: ["r"] },
      ),
    /takım bulunamadı/,
  );
  assert.throws(
    () => prepareEditorChanges(data, editor, context),
    /En az bir kayıt/,
  );
});

test("all entity editor drafts retain opening revisions after a background snapshot changes", () => {
  for (const kind of [
    "project",
    "projectPhase",
    "milestone",
    "resource",
    "bulkResources",
  ]) {
    const data = fixture();
    data.projects[0].milestones = [milestone()];
    const baseRevisions = captureEditorRevisions(data);
    const draft =
      kind === "resource"
        ? {
            kind,
            baseRevisions,
            isNew: false,
            value: structuredClone(data.resources[0]),
            version: { ...version },
          }
        : kind === "bulkResources"
          ? {
              kind,
              baseRevisions,
              effective: "2026-10",
              team: "",
              lead: "",
              status: "",
              included: "no",
            }
          : kind === "milestone"
            ? {
                kind,
                baseRevisions,
                isNew: false,
                draftEmpty: false,
                projectId: "p",
                value: milestone(),
              }
            : {
                kind,
                baseRevisions,
                isNew: false,
                phaseMonth: "2026-10",
                value: structuredClone(data.projects[0]),
              };
    const target =
      kind === "resource" || kind === "bulkResources" ? "resource" : "project";
    const id = target === "resource" ? "r" : "p";
    const opening = data.revisions[target + ":" + id];
    applyChanges(data, admin, [
      {
        kind: target,
        id,
        revision: opening,
        value:
          target === "resource"
            ? { ...data.resources[0], note: "Remote note" }
            : { ...data.projects[0], responsibleName: "Remote owner" },
      },
    ]);
    const afterRemote = structuredClone(data);
    const changes = prepareEditorChanges(data, draft, {
      ...context,
      resourceIds: ["r"],
    });
    assert.equal(changes.at(-1).revision, opening, kind);
    assert.throws(
      () => applyChanges(data, admin, changes),
      (error) => error.status === 409,
      kind,
    );
    assert.deepEqual(data, afterRemote);
    assert.equal(baseRevisions[target + ":" + id], opening);
  }
});

test("resource drafts also keep the opening revision of a previously unassigned team", () => {
  const data = fixture();
  const draft = {
    kind: "resource",
    baseRevisions: captureEditorRevisions(data),
    isNew: true,
    value: { id: "new", name: "Synthetic", note: "", versions: [] },
    version: { ...version, team: "unassigned" },
  };
  data.revisions["team:unassigned"] = 1;
  const commands = prepareEditorChanges(data, draft, context);
  assert.equal(commands[0].revision, 0);
  assert.throws(
    () => applyChanges(data, admin, commands),
    (error) => error.status === 409,
  );
  assert.equal(data.resources.length, 1);
});
