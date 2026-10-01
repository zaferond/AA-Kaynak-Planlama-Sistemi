import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import {
  applyChanges,
  applyLeaderChange,
  restore,
} from "../backend/operations.mjs";

const password = hashPassword("Persistence-test-only-284!");
async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-persistence-"));
  const env = {
    NODE_ENV: "test",
    DB_PROVIDER: "sqljs",
    SQLJS_FILE: path.join(dir, "test.sqlite"),
  };
  const store = new Store({ env });
  const originalRaw = store.db.raw,
    originalUpsert = store.db.upsert;
  t.after(async () => {
    store.db.raw = originalRaw;
    store.db.upsert = originalUpsert;
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  await store.bootstrapUser({
    _id: "test-admin",
    username: "test.admin",
    name: "Admin",
    role: "admin",
    leaders: [],
    active: true,
    password: await password,
    revision: 1,
    version: 1,
  });
  const user = await store.findUser({ id: "test-admin" });
  const team = (await store.read()).data.teams.find((team) => team.lead);
  await store.mutate(user, (data, active) => {
    applyChanges(data, active, [
      {
        kind: "project",
        id: "p",
        value: {
          id: "p",
          name: "Project",
          start: "2026-01",
          end: "2030-12",
          phases: {},
        },
        revision: 0,
      },
      {
        kind: "resource",
        id: "r",
        value: {
          id: "r",
          name: "Resource",
          note: "",
          versions: [
            {
              effective: "2026-01",
              team: team.id,
              lead: team.lead,
              status: "Aktif Çalışan",
              included: true,
              start: "2026-01-01",
              end: "",
              amount: 1,
            },
          ],
        },
        revision: 0,
      },
      {
        kind: "calendar",
        id: "shared",
        value: {
          "2026-09-02": { type: "company", label: "Half day", fraction: 0.5 },
        },
        revision: 0,
      },
      {
        kind: "personDay",
        id: "r|2026-09-03|leave",
        value: { type: "leave", hours: 2, label: "Private label" },
        revision: 0,
      },
    ]);
    data.legacyArchive = {
      teams: [],
      allocations: { archived: 0.25 },
      resourceTeams: {},
    };
  });
  const queries = [],
    upserts = [];
  store.db.raw = function (sql, values) {
    if (/^UPDATE kp_settings SET/i.test(sql))
      queries.push({ sql, values: structuredClone(values || []) });
    return originalRaw.call(this, sql, values);
  };
  store.db.upsert = function (name, rows) {
    if (rows.length) upserts.push({ name, rows: structuredClone(rows) });
    return originalUpsert.call(this, name, rows);
  };
  return {
    store,
    user,
    env,
    team,
    queries,
    upserts,
    clear() {
      queries.length = 0;
      upserts.length = 0;
    },
  };
}

test("a cell edit writes only its value/revision/audit and generation; same-value edits still advance revision", async (t) => {
  const { store, user, team, queries, upserts, clear } = await setup(t);
  const before = await store.read(),
    audit = (await store.auditLog(user)).total;
  const id = team.id + "|p|2026-09";
  await store.mutate(user, (data, active) =>
    applyChanges(data, active, [
      { kind: "allocation", id, value: 0.25, revision: 0 },
    ]),
  );
  assert.deepEqual(upserts.map((entry) => entry.name).sort(), [
    "allocations",
    "audit_events",
    "revisions",
  ]);
  assert.deepEqual(queries, [
    {
      sql: "UPDATE kp_settings SET generation=generation+1 WHERE id=1",
      values: [],
    },
  ]);
  const after = await store.read();
  assert.equal(after.data.allocations[id], 0.25);
  assert.equal(after.data.revisions["allocation:" + id], 1);
  assert.equal(after.generation, before.generation + 1);
  for (const key of [
    "leaders",
    "leaderManagers",
    "workCalendar",
    "personCalendar",
    "legacyArchive",
  ])
    assert.deepEqual(after.data[key], before.data[key]);
  assert.equal((await store.auditLog(user)).total, audit + 1);
  clear();
  await store.mutate(user, (data, active) =>
    applyChanges(data, active, [
      { kind: "allocation", id, value: 0.25, revision: 1 },
    ]),
  );
  assert.deepEqual(
    upserts.map((entry) => entry.name),
    ["revisions"],
  );
  assert.equal((await store.read()).data.revisions["allocation:" + id], 2);
  assert.equal((await store.read()).generation, before.generation + 2);
  assert.equal((await store.auditLog(user)).total, audit + 1);
  assert.deepEqual(queries[0].values, []);
});

test("settings updates include only changed JSON columns and restore can clear calendars and the legacy archive", async (t) => {
  const { store, user, queries, clear } = await setup(t);
  const before = (await store.read()).data;
  await store.mutate(user, (data, active) =>
    applyChanges(data, active, [
      {
        kind: "calendar",
        id: "shared",
        value: {
          ...data.workCalendar,
          "2026-09-01": { type: "official", label: "Holiday", fraction: 1 },
        },
        revision: 1,
      },
    ]),
  );
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /\[calendar_days\]=@p0/);
  assert.doesNotMatch(queries[0].sql, /person_calendar|legacy_archive/);
  assert.equal(queries[0].values.length, 1);
  assert.deepEqual(
    (await store.read()).data.personCalendar,
    before.personCalendar,
  );
  clear();
  await store.mutate(user, (data, active) =>
    applyChanges(data, active, [
      {
        kind: "personDay",
        id: "r|2026-09-03|leave",
        value: { type: "leave", hours: 2.5, label: "  Edited label  " },
        revision: 1,
      },
    ]),
  );
  assert.match(queries[0].sql, /\[person_calendar\]=@p0/);
  assert.doesNotMatch(queries[0].sql, /calendar_days|legacy_archive/);
  assert.equal(queries[0].values.length, 1);
  assert.equal(
    JSON.parse(queries[0].values[0])["r|2026-09-03|leave"].label,
    "Edited label",
  );
  const backup = (await store.read()).data;
  backup.personCalendar = {};
  backup.workCalendar = {};
  delete backup.legacyArchive;
  clear();
  await store.mutate(user, (data, active) => restore(data, active, backup));
  assert.deepEqual(queries[0].values, [null, "{}", "{}"]);
  const after = (await store.read()).data;
  assert.deepEqual(after.workCalendar, {});
  assert.deepEqual(after.personCalendar, {});
  assert.equal(after.legacyArchive, undefined);
});

test("leader manager edits and new team relationships write their changed leaders before dependent rows", async (t) => {
  const { store, user, team, upserts, queries, clear } = await setup(t);
  await store.mutate(user, (data, active, c, generation) =>
    applyLeaderChange(
      data,
      active,
      { action: "update", name: team.lead, managerName: "Manager", generation },
      c,
      generation,
    ),
  );
  assert.deepEqual(
    upserts
      .filter((entry) => entry.name === "leaders")
      .flatMap((entry) => entry.rows),
    [{ name: team.lead, manager_name: "Manager" }],
  );
  assert.equal((await store.read()).data.leaderManagers[team.lead], "Manager");
  assert.deepEqual(queries[0].values, []);
  clear();
  await store.mutate(user, (data) => {
    data.leaders.push("New leader");
    data.teams.push({
      id: "extra",
      name: "New team",
      lead: "New leader",
      excelCapacity: 0,
      catalog: true,
    });
    data.revisions["team:extra"] = 1;
  });
  assert.deepEqual(
    upserts
      .filter((entry) => entry.name === "leaders")
      .flatMap((entry) => entry.rows),
    [{ name: "New leader", manager_name: "" }],
  );
  assert(
    upserts.findIndex((entry) => entry.name === "leaders") <
      upserts.findIndex((entry) => entry.name === "teams"),
  );
  assert.equal(
    (await store.read()).data.teams.find((team) => team.id === "extra").lead,
    "New leader",
  );
});

test("failure after the settings write rolls back changed rows, leaders, metadata, audit and generation across restart", async (t) => {
  const { store, user, env, team } = await setup(t);
  const before = await store.read(),
    audit = (await store.auditLog(user)).total;
  const raw = store.db.raw;
  store.db.raw = function (sql, values) {
    const result = raw.call(this, sql, values);
    if (/^UPDATE kp_settings SET/i.test(sql))
      throw Error("Injected settings failure");
    return result;
  };
  await assert.rejects(
    () =>
      store.mutate(user, (data, active) => {
        applyChanges(data, active, [
          {
            kind: "allocation",
            id: team.id + "|p|2026-09",
            value: 0.5,
            revision: 0,
          },
          { kind: "calendar", id: "shared", value: {}, revision: 1 },
        ]);
        data.leaders.push("Rolled back leader");
      }),
    /Injected settings failure/,
  );
  store.db.raw = raw;
  assert.deepEqual(await store.read(), before);
  assert.equal((await store.auditLog(user)).total, audit);
  await store.close();
  const reopened = new Store({ env });
  try {
    await reopened.connect();
    assert.deepEqual(await reopened.read(), before);
    assert.equal((await reopened.auditLog(user)).total, audit);
  } finally {
    await reopened.close();
  }
});
