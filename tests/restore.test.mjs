import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { restore, applyChanges } from "../backend/operations.mjs";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";

const admin = { _id: "root-admin", role: "admin", leaders: [] };
const hoursKey = "r|2026-01",
  dayKey = "r|2026-01-05|leave";
const fixture = () => ({
  teams: [
    { id: "t", name: "Takım", lead: "A", excelCapacity: 0, catalog: true },
  ],
  projects: [
    { id: "p", name: "Proje", start: "2026-01", end: "2026-12", phases: {} },
  ],
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
  actualAllocations: {},
  actualWorkedHours: {},
  personCalendar: {},
  revisions: {},
  leaders: ["A"],
  catalogVersion: 2,
});
test("restore advances revisions for deleted hours and personal days and rejects stale writes", () => {
  const current = fixture(),
    backup = fixture();
  for (const key of ["workedHours:" + hoursKey, "personDay:" + dayKey]) {
    current.revisions[key] = 4;
    backup.revisions[key] = 2;
  }
  const untouched = structuredClone(backup);
  restore(current, admin, backup);
  assert.deepEqual(backup, untouched);
  assert.equal(current.revisions["workedHours:" + hoursKey], 5);
  assert.equal(current.revisions["personDay:" + dayKey], 5);
  for (const change of [
    { kind: "workedHours", id: hoursKey, value: 180, revision: 2 },
    {
      kind: "personDay",
      id: dayKey,
      value: { type: "leave", hours: 2, label: "" },
      revision: 2,
    },
  ])
    assert.throws(
      () => applyChanges(current, admin, [change]),
      (e) => e.status === 409,
    );
});
test("restore derives revisions from current state, including deleted records, instead of trusting backup counters", () => {
  const current = fixture(),
    backup = fixture();
  current.revisions = {
    "project:p": 7,
    "resource:r": 3,
    "project:deleted": 8,
    ["workedHours:" + hoursKey]: 4,
  };
  backup.revisions = {
    "project:p": 99999,
    "workedHours:unknown|2026-01": 99999,
    "user:root-admin": 99999,
    "unknown:record": 99999,
  };
  backup.projects.push({ ...backup.projects[0], id: "new", name: "Yeni" });
  restore(current, admin, backup);
  assert.equal(current.revisions["project:p"], 8);
  assert.equal(current.revisions["project:deleted"], 9);
  assert.equal(current.revisions["project:new"], 1);
  assert.equal(current.revisions["workedHours:" + hoursKey], 5);
  for (const key of [
    "workedHours:unknown|2026-01",
    "user:root-admin",
    "unknown:record",
  ])
    assert.equal(current.revisions[key], undefined);
});
test("an invalid restore leaves the source unchanged and normal users cannot restore", () => {
  const current = fixture(),
    original = structuredClone(current),
    backup = fixture();
  backup.projects.push({ ...backup.projects[0] });
  assert.throws(() => restore(current, admin, backup), /Tekrarlanan/);
  assert.deepEqual(current, original);
  assert.throws(
    () => restore(current, { ...admin, role: "normal" }, fixture()),
    (e) => e.status === 403,
  );
});

test("HTTP restore keeps revision conflict protection across deleted entries and restart", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-restore-"));
  const env = {
    DB_PROVIDER: "sqljs",
    NODE_ENV: "test",
    SQLJS_FILE: path.join(dir, "test.sqlite"),
  };
  let store = new Store({ env }),
    app,
    server;
  try {
    await store.connect();
    const password = "Restore-test-only-284!";
    await store.bootstrapUser({
      ...admin,
      username: "test.admin",
      name: "Admin",
      active: true,
      password: await hashPassword(password),
      revision: 1,
      version: 1,
    });
    server = http.createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = "http://127.0.0.1:" + server.address().port;
    app = createApp(store, { origin });
    server.on("request", app);
    let cookie = "",
      csrf = "";
    async function request(url, body, expected = 200) {
      const response = await fetch(origin + "/api" + url, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: cookie,
          ...(body === undefined
            ? {}
            : {
                Origin: origin,
                "Content-Type": "application/json",
                "X-Requested-With": "KaynakPortal",
                "X-CSRF-Token": csrf,
              }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await response.json();
      assert.equal(response.status, expected, JSON.stringify(json));
      return { json, response };
    }
    const login = await request("/auth/login", {
      username: "test.admin",
      password,
    });
    cookie = login.response.headers.get("set-cookie").split(";")[0];
    csrf = login.json.csrf;
    const user = await store.findUser({ id: "root-admin" });
    const team = (await store.read()).data.teams.find((x) => x.lead);
    const resource = fixture().resources[0];
    resource.versions[0].team = team.id;
    resource.versions[0].lead = team.lead;
    await store.mutate(user, (d) =>
      applyChanges(d, user, [
        { kind: "resource", id: "r", value: resource, revision: 0 },
      ]),
    );
    const edits = (revision, remove = false) => [
      {
        kind: "workedHours",
        id: hoursKey,
        value: remove ? null : 180,
        revision,
      },
      {
        kind: "personDay",
        id: dayKey,
        ...(remove
          ? { operation: "delete" }
          : { value: { type: "leave", hours: 2, label: "" } }),
        revision,
      },
    ];
    await request("/changes", { changes: edits(0) });
    await request("/changes", { changes: edits(1, true) });
    const backup = (await request("/backup")).json;
    assert.equal(backup.data.users, undefined);
    await request("/changes", { changes: edits(2) });
    await request("/changes", { changes: edits(3, true) });
    const before = (await request("/data")).json;
    const auditBeforeInvalid = (await request("/audit")).json.total;
    const invalid = structuredClone(backup.data);
    invalid.projects = [
      fixture().projects[0],
      { ...fixture().projects[0], id: "q" },
    ];
    invalid.actualAllocations = { "r|p|2026-01": 0.6, "r|q|2026-01": 0.6 };
    invalid.actualPercentEntries = { "r|p|2026-01": 60, "r|q|2026-01": 60 };
    invalid.actualWorkedHours = { [hoursKey]: 180 };
    const rejected = await request(
      "/restore",
      { data: invalid, generation: before.generation },
      400,
    );
    assert.match(rejected.json.error, /%100/);
    assert.deepEqual((await request("/data")).json, before);
    assert.equal((await request("/audit")).json.total, auditBeforeInvalid);
    await request(
      "/restore",
      { data: backup.data, generation: before.generation - 1 },
      409,
    );
    const restored = (
      await request("/restore", {
        data: backup.data,
        generation: before.generation,
      })
    ).json;
    assert.equal(restored.data.revisions["workedHours:" + hoursKey], 5);
    assert.equal(restored.data.revisions["personDay:" + dayKey], 5);
    assert.equal(restored.generation, before.generation + 1);
    assert.equal(restored.data.actualWorkedHours[hoursKey], undefined);
    assert.equal(restored.data.personCalendar[dayKey], undefined);
    for (const change of edits(2))
      await request("/changes", { changes: [change] }, 409);
    for (const change of edits(4))
      await request("/changes", { changes: [change] }, 409);
    assert.equal((await request("/data")).json.generation, restored.generation);
    app.locals.close();
    await new Promise((resolve) => server.close(resolve));
    server = null;
    await store.close();
    store = new Store({ env });
    await store.connect();
    const after = await store.read();
    assert.equal(after.generation, restored.generation);
    assert.equal(after.data.revisions["workedHours:" + hoursKey], 5);
    assert.equal(after.data.revisions["personDay:" + dayKey], 5);
  } finally {
    app?.locals.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("restore preserves account permissions and reports linked-leadership conflicts without changing data", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-restore-accounts-"));
  const store = new Store({
    env: {
      DB_PROVIDER: "sqljs",
      NODE_ENV: "test",
      SQLJS_FILE: path.join(dir, "test.sqlite"),
    },
  });
  try {
    await store.connect();
    const password = await hashPassword("Restore-accounts-test-284!");
    await store.bootstrapUser({
      ...admin,
      username: "test.admin",
      name: "Admin",
      active: true,
      password,
      revision: 1,
      version: 1,
    });
    const actor = await store.findUser({ id: "root-admin" });
    await store.mutate(actor, (d, u) => restore(d, u, fixture()));
    await store.bootstrapUser({
      _id: "normal",
      username: "test.normal",
      name: "Normal",
      role: "normal",
      leaders: ["A"],
      resourceId: "r",
      active: true,
      password,
      revision: 1,
      version: 1,
    });
    const beforeUser = await store.findUser({ id: "normal" });
    const backup = structuredClone((await store.read()).data);
    backup.resources = [];
    backup.users = [
      {
        id: "normal",
        username: "test.normal",
        name: "Forged Admin",
        role: "admin",
        leaders: [],
        active: true,
      },
    ];
    await store.mutate(actor, (d, u) => restore(d, u, backup));
    const afterUser = await store.findUser({ id: "normal" });
    assert.deepEqual(afterUser, { ...beforeUser, resourceId: "" });
    assert.equal((await store.view(afterUser)).user.resourceId, "");
    assert.deepEqual((await store.view(afterUser)).data.actualAllocations, {});
    const state = await store.read(),
      audit = await store.auditLog(actor);
    const conflicting = structuredClone(state.data);
    conflicting.leaders = [];
    conflicting.leaderManagers = {};
    conflicting.teams[0].lead = "";
    await assert.rejects(
      () => store.mutate(actor, (d, u) => restore(d, u, conflicting)),
      (error) =>
        error.status === 409 && /kullanıcı yetkilerinde/.test(error.message),
    );
    assert.deepEqual(await store.read(), state);
    assert.equal((await store.auditLog(actor)).total, audit.total);
    assert.deepEqual(await store.findUser({ id: "normal" }), afterUser);
  } finally {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
