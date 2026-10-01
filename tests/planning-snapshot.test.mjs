import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { applyChanges } from "../backend/operations.mjs";
import { changeAndView } from "../backend/change-service.mjs";

const password = hashPassword("Snapshot-test-only-284!");
async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-planning-view-"));
  const env = {
    NODE_ENV: "test",
    DB_PROVIDER: "sqljs",
    SQLJS_FILE: path.join(dir, "test.sqlite"),
  };
  const store = new Store({ env });
  t.after(async () => {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  const teams = (await store.read()).data.teams;
  const team = teams.find((item) => item.lead);
  const other = teams.find((item) => item.lead && item.lead !== team.lead);
  const roles = [
    ["admin", "admin", []],
    ["manager", "manager", [team.lead]],
    ["unassigned", "manager", []],
    ["normal", "normal", [team.lead]],
  ];
  const users = {};
  for (const [id, role, leaders] of roles) {
    await store.bootstrapUser({
      _id: id,
      username: "snapshot." + id,
      name: "Synthetic " + id,
      role,
      leaders,
      resourceId: "",
      active: true,
      password: await password,
      revision: 1,
      version: 1,
    });
    users[id] = await store.findUser({ id });
  }
  const key = team.id + "|p|2026-09";
  const hiddenKey = other.id + "|p|2026-09";
  await store.mutate(users.admin, (data, active) => {
    applyChanges(data, active, [
      {
        kind: "project",
        id: "p",
        revision: 0,
        value: {
          id: "p",
          name: "Project",
          start: "2026-01",
          end: "2030-12",
          phases: { "2026-09": "Analysis" },
          milestones: [
            {
              id: "note",
              name: "Critical topic",
              start: "2026-09-01",
              end: "2026-09-30",
              barNotes: [
                { text: "Detail", includeInReport: true, completed: true },
              ],
            },
          ],
        },
      },
      ...[team, other].map((item, i) => ({
        kind: "resource",
        id: "r" + i,
        revision: 0,
        value: {
          id: "r" + i,
          name: "Private person " + i,
          note: "Private note",
          code: "Private code",
          versions: [
            {
              effective: "2026-01",
              team: item.id,
              lead: item.lead,
              status: "Aktif Çalışan",
              included: true,
              start: "2026-01-01",
              end: "",
              amount: 1,
            },
          ],
        },
      })),
      { kind: "allocation", id: hiddenKey, value: 0.75, revision: 0 },
      { kind: "actual", id: "r0|p|2026-01", value: 0.25, revision: 0 },
      { kind: "actual", id: "r1|p|2026-01", value: 0.5, revision: 0 },
      {
        kind: "personDay",
        id: "r1|2026-09-02|leave",
        value: { type: "leave", hours: 2, label: "Private leave" },
        revision: 0,
      },
    ]);
    data.legacyArchive = { teams: [], allocations: {}, resourceTeams: {} };
  });
  await store.transaction((c) =>
    store.saveUser({ ...users.normal, resourceId: "r0" }, c),
  );
  users.normal = await store.findUser({ id: "normal" });
  return { store, env, users, team, other, key, hiddenKey };
}

test("planning responses match fresh SQL views with one full read for create, zero, same value, batch and delete", async (t) => {
  const { store, users, key, team } = await setup(t);
  const original = store.read;
  let reads = 0;
  t.mock.method(store, "read", async function (...args) {
    reads++;
    return original.apply(this, args);
  });
  const second = team.id + "|p|2026-10";
  const batches = [
    [{ kind: "allocation", id: key, value: 0.5, revision: 0 }],
    [{ kind: "allocation", id: key, value: 0, revision: 1 }],
    [{ kind: "allocation", id: key, value: 0, revision: 2 }],
    [
      { kind: "allocation", id: key, value: 1, revision: 3 },
      { kind: "allocation", id: second, value: 0.25, revision: 0 },
    ],
    [{ kind: "allocation", id: key, operation: "delete", revision: 4 }],
  ];
  for (const changes of batches) {
    reads = 0;
    const result = await changeAndView(store, users.admin, changes);
    assert.equal(reads, 1);
    assert.deepEqual(result, await store.view(users.admin));
    assert.equal(JSON.stringify(result).includes('"password"'), false);
  }
  const after = await store.view(users.admin);
  assert.equal(Object.hasOwn(after.data.allocations, key), false);
  assert.equal(after.data.revisions["allocation:" + key], 5);
});

test("planning responses keep manager scope and reject forbidden, stale and disabled principals without writes", async (t) => {
  const { store, users, key, hiddenKey } = await setup(t);
  const result = await changeAndView(store, users.manager, [
    { kind: "allocation", id: key, value: 0.5, revision: 0 },
  ]);
  assert.deepEqual(result, await store.view(users.manager));
  assert.equal(Object.hasOwn(result.data.allocations, hiddenKey), false);
  assert.equal(result.data.users, undefined);
  assert.equal(result.data.legacyArchive, undefined);
  assert.equal(
    result.data.resources.some((item) => item.id === "r1"),
    false,
  );
  assert.equal(Object.keys(result.data.personCalendar).length, 0);
  assert.equal(result.data.actualAllocations["r0|p|2026-01"], 0.25);
  assert.equal(result.data.actualTeamTotals !== undefined, true);
  const before = await store.view(users.admin);
  const audit = (await store.auditLog(users.admin)).total;
  for (const [user, id, revision, status] of [
    [users.manager, hiddenKey, 1, 403],
    [users.unassigned, key, 1, 403],
    [users.normal, key, 1, 403],
    [users.manager, key, 0, 409],
    [{ ...users.manager, version: 0 }, key, 1, 401],
  ]) {
    await assert.rejects(
      changeAndView(store, user, [
        { kind: "allocation", id, value: 1, revision },
      ]),
      (error) => error.status === status,
    );
  }
  await store.transaction((c) =>
    store.saveUser({ ...users.manager, active: false }, c),
  );
  await assert.rejects(
    changeAndView(store, users.manager, [
      { kind: "allocation", id: key, value: 1, revision: 1 },
    ]),
    (error) => error.status === 401,
  );
  await store.transaction((c) => store.saveUser(users.manager, c));
  assert.deepEqual(await store.view(users.admin), before);
  assert.equal((await store.auditLog(users.admin)).total, audit);
});

test("mixed entity/planning changes use a fresh SQL representation and invalid batches stay atomic", async (t) => {
  const { store, users, key } = await setup(t);
  const original = store.read;
  let reads = 0;
  t.mock.method(store, "read", async function (...args) {
    reads++;
    return original.apply(this, args);
  });
  const result = await changeAndView(store, users.admin, [
    { kind: "allocation", id: key, value: 0.5, revision: 0 },
    {
      kind: "project",
      id: "new",
      revision: 0,
      value: {
        id: "new",
        name: " New project ",
        start: "2026-01",
        end: "2030-12",
        phases: {},
      },
    },
  ]);
  assert.equal(reads, 2);
  assert.deepEqual(result, await store.view(users.admin));
  assert.equal(
    result.data.projects.find((item) => item.id === "new").name,
    "New project",
  );
  assert.deepEqual(
    result.data.projects.find((item) => item.id === "new").milestones,
    [],
  );
  const before = await store.view(users.admin);
  const audit = (await store.auditLog(users.admin)).total;
  for (const changes of [
    [],
    [null],
    [
      { kind: "allocation", id: key, value: 1, revision: 1 },
      { kind: "allocation", id: key, value: 2, revision: 1 },
    ],
    [
      { kind: "allocation", id: key, value: 1, revision: 1 },
      { kind: "allocation", id: "missing|p|2026-09", value: 1, revision: 0 },
    ],
  ])
    await assert.rejects(changeAndView(store, users.admin, changes));
  assert.deepEqual(await store.view(users.admin), before);
  assert.equal((await store.auditLog(users.admin)).total, audit);
});

test("legacy metadata normalization falls back to a transaction-local SQL read", async (t) => {
  const { store, users, key, team } = await setup(t);
  await store.transaction((c) =>
    c.query("UPDATE kp_teams SET name=@p0 WHERE id=@p1", [
      " Legacy team ",
      team.id,
    ]),
  );
  const original = store.read;
  let reads = 0;
  t.mock.method(store, "read", async function (...args) {
    reads++;
    return original.apply(this, args);
  });
  const result = await changeAndView(store, users.admin, [
    { kind: "allocation", id: key, value: 0.5, revision: 0 },
  ]);
  assert.equal(reads, 2);
  assert.deepEqual(result, await store.view(users.admin));
  assert.equal(
    result.data.teams.find((item) => item.id === team.id).name,
    "Legacy team",
  );
});

test("a prepared planning response is not returned when disk commit fails and data survives restart unchanged", async (t) => {
  const { store, users, key, env } = await setup(t);
  const before = await store.view(users.admin);
  const audit = (await store.auditLog(users.admin)).total;
  const originalFile = store.db.file;
  const blocker = originalFile + "-directory";
  await fs.mkdir(blocker);
  let projected = 0;
  const original = store.projectView;
  t.mock.method(store, "projectView", async function (...args) {
    projected++;
    return original.apply(this, args);
  });
  store.db.file = blocker;
  try {
    await assert.rejects(
      changeAndView(store, users.admin, [
        { kind: "allocation", id: key, value: 0.5, revision: 0 },
      ]),
      (error) => ["EISDIR", "ENOTDIR"].includes(error.code),
    );
  } finally {
    store.db.file = originalFile;
  }
  assert.equal(projected, 1);
  assert.deepEqual(await store.view(users.admin), before);
  assert.equal((await store.auditLog(users.admin)).total, audit);
  await store.close();
  const reopened = new Store({ env });
  try {
    await reopened.connect();
    assert.deepEqual(await reopened.view(users.admin), before);
    assert.equal((await reopened.auditLog(users.admin)).total, audit);
  } finally {
    await reopened.close();
  }
});
