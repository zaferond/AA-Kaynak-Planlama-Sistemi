import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  copyPhaseRows,
  preparePhaseRowsPaste,
  preparePhaseRowsFill,
} from "../frontend/src/features/project-clipboard.ts";
import { applyChanges } from "../backend/operations.mjs";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";

const project = (id, text, color) => ({
  id,
  name: id,
  start: "2026-01",
  end: "2026-12",
  responsibleName: "Owner " + id,
  phases: { "2026-01": text, "2026-12": "Year end " + id },
  phaseColors: { "2026-01": color },
  milestones: [
    {
      id: "topic",
      name: "Topic",
      start: "2026-03-01",
      end: "2026-03-02",
      barNotes: [{ text: "Private topic", includeInReport: true }],
    },
  ],
});
const fixture = () => ({
  projects: [
    project("a", "Analiz", "green"),
    project("b", "Test", "red"),
    project("c", "Old", "amber"),
  ],
  revisions: { "project:a": 2, "project:b": 3, "project:c": 4 },
});

test("row copy captures all months including blank/default-colored phases and survives later source edits", () => {
  const data = fixture();
  const before = structuredClone(data);
  const clipboard = copyPhaseRows([data.projects[0]]);
  assert.equal(clipboard.rows[0].cells.length, 12);
  assert.deepEqual(clipboard.rows[0].cells[1], {
    month: "2026-02",
    value: { text: "", color: "gray" },
  });
  assert.equal(clipboard.rows[0].cells[11].value.text, "Year end a");
  assert.deepEqual(data, before);
  data.projects[0].phases["2026-01"] = "Changed";
  assert.equal(clipboard.rows[0].cells[0].value.text, "Analiz");
});

test("one source row broadcasts text/color/bundle with one current revision per target and preserves metadata", () => {
  for (const kind of ["text", "color", "bundle"]) {
    const data = fixture(),
      before = structuredClone(data);
    const commands = preparePhaseRowsPaste(
      data,
      ["b", "c", "b"],
      copyPhaseRows([data.projects[0]]),
      kind,
    );
    assert.equal(commands.length, 2);
    assert.deepEqual(
      commands.map((c) => [c.id, c.revision]),
      [
        ["b", 3],
        ["c", 4],
      ],
    );
    assert.deepEqual(data, before);
    for (const command of commands) {
      const old = before.projects.find((p) => p.id === command.id);
      assert.equal(command.value.name, old.name);
      assert.equal(command.value.responsibleName, old.responsibleName);
      assert.deepEqual(command.value.milestones, old.milestones);
      assert.equal(command.value.start, old.start);
      assert.equal(command.value.end, old.end);
      if (kind === "text")
        assert.deepEqual(command.value.phaseColors, old.phaseColors);
      else assert.equal(command.value.phaseColors["2026-01"], "green");
      if (kind === "color") assert.deepEqual(command.value.phases, old.phases);
      else {
        assert.equal(command.value.phases["2026-01"], "Analiz");
        assert.equal(command.value.phases["2026-02"], "");
      }
    }
  }
});

test("multiple rows map in source/target order and reject mismatched counts or invalid calendar targets before writing", () => {
  const data = fixture(),
    before = structuredClone(data);
  const clipboard = copyPhaseRows(data.projects.slice(0, 2));
  const commands = preparePhaseRowsPaste(data, ["c", "a"], clipboard, "bundle");
  assert.equal(commands[0].value.phases["2026-01"], "Analiz");
  assert.equal(commands[1].value.phases["2026-01"], "Test");
  assert.throws(
    () => preparePhaseRowsPaste(data, ["c"], clipboard, "bundle"),
    /sayıları eşit/,
  );
  assert.throws(
    () => preparePhaseRowsPaste(data, ["c", "missing"], clipboard, "text"),
    /Proje bulunamadı/,
  );
  assert.throws(() => copyPhaseRows([]), /satırlarını seçin/);
  const shorter = structuredClone(data);
  shorter.projects[2].start = "2026-02";
  assert.throws(
    () =>
      preparePhaseRowsPaste(
        shorter,
        ["c"],
        copyPhaseRows([data.projects[0]]),
        "text",
      ),
    /hedef proje dönemi dışında/,
  );
  assert.deepEqual(data, before);
});

test("a single copied phase fills all selected project months while keeping the other field and using each project's dates", () => {
  const data = fixture();
  data.projects[2].start = "2026-10";
  for (const content of [
    { kind: "text", text: "Yeni" },
    { kind: "color", color: "purple" },
    { kind: "bundle", text: "", color: "gray" },
  ]) {
    const before = structuredClone(data);
    const commands = preparePhaseRowsFill(data, ["b", "c"], content);
    assert.deepEqual(data, before);
    assert.equal(
      Object.keys(
        commands[1].value[content.kind === "color" ? "phaseColors" : "phases"],
      ).filter((month) => month >= "2026-10").length,
      3,
    );
    for (const cmd of commands) {
      const original = data.projects.find((p) => p.id === cmd.id);
      if (content.kind === "text")
        assert.deepEqual(cmd.value.phaseColors, original.phaseColors);
      if (content.kind === "color")
        assert.deepEqual(cmd.value.phases, original.phases);
      assert.equal(
        cmd.value.phases["2026-12"],
        content.kind === "color" ? original.phases["2026-12"] : content.text,
      );
    }
  }
});

test("multi-project row paste is atomic in SQL: conflicts and normal users cannot partially write", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-project-rows-"));
  const store = new Store({
    env: {
      NODE_ENV: "test",
      DB_PROVIDER: "sqljs",
      SQLJS_FILE: path.join(dir, "test.sqlite"),
    },
  });
  t.after(async () => {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  const password = await hashPassword("Row-test-only-284!");
  for (const role of ["admin", "normal"])
    await store.bootstrapUser({
      _id: role,
      username: "row." + role,
      name: role,
      role,
      leaders: [],
      resourceId: "",
      active: true,
      password,
      version: 1,
      revision: 1,
    });
  const admin = await store.findUser({ id: "admin" }),
    normal = await store.findUser({ id: "normal" });
  await store.mutate(admin, (data, active) =>
    applyChanges(
      data,
      active,
      fixture().projects.map((value) => ({
        kind: "project",
        id: value.id,
        revision: 0,
        value,
      })),
    ),
  );
  const before = await store.read();
  const commands = preparePhaseRowsPaste(
    before.data,
    ["b", "c"],
    copyPhaseRows([before.data.projects.find((p) => p.id === "a")]),
    "bundle",
  );
  await assert.rejects(
    store.mutate(normal, (data, active) =>
      applyChanges(data, active, commands),
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    store.mutate(admin, (data, active) =>
      applyChanges(data, active, [
        commands[0],
        { ...commands[1], revision: 0 },
      ]),
    ),
    (e) => e.status === 409,
  );
  assert.deepEqual(await store.read(), before);
  await store.mutate(admin, (data, active) =>
    applyChanges(data, active, commands),
  );
  const after = await store.read();
  assert.equal(after.generation, before.generation + 1);
  for (const id of ["b", "c"]) {
    assert.equal(
      after.data.projects.find((p) => p.id === id).phases["2026-12"],
      "Year end a",
    );
    assert.equal(
      after.data.revisions["project:" + id],
      before.data.revisions["project:" + id] + 1,
    );
  }
});
