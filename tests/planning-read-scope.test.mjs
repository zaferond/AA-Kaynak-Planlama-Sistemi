import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { readCompositeMap } from "../backend/read-records.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { applyChanges } from "../backend/operations.mjs";
import { seedBenchmarkStore } from "../scripts/benchmark-fixture.mjs";

const password = hashPassword("Read-scope-test-only-284!");
async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-planning-read-"));
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
  await seedBenchmarkStore(store, 1000, {
    resources: 20,
    actuals: 200,
    percentages: 200,
    calendarDays: 20,
  });
  const teams = (await store.read()).data.teams;
  const team = teams.find((x) => x.lead),
    other = teams.find((x) => x.lead && x.lead !== team.lead);
  const users = {};
  for (const [id, role, leaders, resourceId] of [
    ["admin", "admin", [], ""],
    ["manager", "manager", [team.lead], ""],
    ["normal", "normal", [team.lead], "bench-r0"],
    ["unassigned", "manager", [], ""],
    ["no-owner", "normal", [], ""],
  ]) {
    await store.bootstrapUser({
      _id: id,
      username: "readscope." + id,
      name: "Synthetic " + id,
      role,
      leaders,
      resourceId,
      active: true,
      password: await password,
      revision: 1,
      version: 1,
    });
    users[id] = await store.findUser({ id });
  }
  const observations = [];
  const raw = store.db.raw;
  t.mock.method(store.db, "raw", function (sql, values, consume) {
    const result = raw.call(this, sql, values, consume);
    if (/^SELECT\b/.test(sql) && /FROM \[kp_allocations\]/.test(sql))
      observations.push({ sql, values, rows: result.rowCount });
    return result;
  });
  const reference = (user) =>
    store.transaction(async (c) => {
      const { data, generation } = await store.read(c);
      const active = await store.findUser({ id: user._id }, c);
      return store.projectView(data, generation, active, c);
    }, true);
  return { store, users, team, other, observations, reference };
}

test("planning read parameters keep SQL fixed and preserve zero/reserved IDs on both adapters", async () => {
  const ids = [
    "constructor",
    "__proto__",
    "x'); DROP TABLE kp_allocations;--",
    "constructor",
  ];
  for (const provider of ["sqljs", "mssql"]) {
    for (const streaming of [true, false]) {
      const check = (sql, params) => {
        assert(
          sql.endsWith(
            " WHERE [team_id] IN (@p0,@p1,@p2)" +
              (provider === "sqljs" ? " ORDER BY rowid" : ""),
          ),
        );
        assert.deepEqual(params, ids.slice(0, 3));
        assert(!sql.includes(ids[2]));
      };
      const c = streaming
        ? {
            scan: async (sql, params, consume) => {
              check(sql, params);
              consume(
                provider === "sqljs"
                  ? ["constructor|p|2026-01", 0]
                  : ["constructor", "p", "2026-01", 0],
              );
              return { rowCount: 1 };
            },
          }
        : {
            query: async (sql, params) => {
              check(sql, params);
              return {
                rows: [
                  provider === "sqljs"
                    ? { record_key: "constructor|p|2026-01", amount: 0 }
                    : {
                        team_id: "constructor",
                        project_id: "p",
                        month: "2026-01",
                        amount: 0,
                      },
                ],
              };
            },
          };
      assert.deepEqual(
        await readCompositeMap(c, provider, "allocations", "amount", ids),
        { "constructor|p|2026-01": 0 },
      );
    }
  }
});

test("empty planning scope reads no rows; large scopes fall back without truncation", async () => {
  for (const provider of ["sqljs", "mssql"]) {
    const scopes = [
      [],
      Array.from({ length: 900 }, (_, i) => "t" + i),
      Array.from({ length: 901 }, (_, i) => "t" + i),
    ];
    for (const ids of scopes) {
      const c = {
        scan: async (sql, params, consume) => {
          assert.equal(params.length, ids.length === 900 ? 900 : 0);
          if (!ids.length)
            assert(
              sql.endsWith(
                " WHERE 1=0" + (provider === "sqljs" ? " ORDER BY rowid" : ""),
              ),
            );
          else if (ids.length === 901) assert(!sql.includes("WHERE"));
          else assert(sql.includes("@p899)"));
          if (ids.length === 901) {
            consume(
              provider === "sqljs"
                ? ["t900|p|2026-01", 1]
                : ["t900", "p", "2026-01", 1],
            );
            return { rowCount: 1 };
          }
          return { rowCount: 0 };
        },
      };
      assert.deepEqual(
        await readCompositeMap(c, provider, "allocations", "amount", ids),
        ids.length === 901 ? { "t900|p|2026-01": 1 } : {},
      );
    }
  }
  const unused = {
    query: () => {
      throw Error("must not query");
    },
  };
  for (const [name, column, scope] of [
    ["actual_allocations", "amount", []],
    ["allocations", "amount", "t"],
    ["allocations", "amount", [1]],
  ])
    await assert.rejects(
      readCompositeMap(unused, "sqljs", name, column, scope),
      /Invalid planning read scope/,
    );
});

test("authenticated scoped SQL views match full reads for all roles, transfers, early history and tombstones", async (t) => {
  const { store, users, team, other, observations, reference } = await setup(t);
  const { data } = await store.read();
  const resource = data.resources.find((r) => r.id === "bench-r0");
  const ownKey = Object.keys(data.allocations).find((k) =>
    k.startsWith(team.id + "|"),
  );
  const deleted = team.id + "|bench-p0|2029-12";
  // A deletion tombstone must originate from a real record, including zero.
  await store.mutate(users.admin, (d, active) =>
    applyChanges(d, active, [
      {
        kind: "allocation",
        id: deleted,
        value: 0,
        revision: d.revisions["allocation:" + deleted] || 0,
      },
    ]),
  );
  await store.mutate(users.admin, (d, active) =>
    applyChanges(d, active, [
      {
        kind: "resource",
        id: resource.id,
        revision: d.revisions["resource:" + resource.id] || 0,
        value: {
          ...resource,
          versions: [
            {
              ...resource.versions[0],
              effective: "2026-03",
              start: "2026-03-01",
            },
            {
              ...resource.versions[0],
              effective: "2026-06",
              team: other.id,
              lead: other.lead,
              status: "İşten Ayrıldı",
              end: "2026-06-30",
            },
          ],
        },
      },
      {
        kind: "allocation",
        id: ownKey,
        revision: d.revisions["allocation:" + ownKey],
        value: 0,
      },
      {
        kind: "allocation",
        id: deleted,
        revision: d.revisions["allocation:" + deleted] || 0,
        operation: "delete",
      },
    ]),
  );
  for (const user of Object.values(users)) {
    observations.length = 0;
    const actual = await store.view(user);
    const read = observations[0];
    const full = await reference(user);
    assert.deepEqual(actual, full);
    assert.deepEqual(
      Object.keys(actual.data.allocations),
      Object.keys(full.data.allocations),
    );
    assert.equal(read.rows, Object.keys(actual.data.allocations).length);
    assert.equal(read.sql.includes("WHERE"), user.role !== "admin");
    if (user.leaders.length) assert(read.rows < 1000);
    if (user.role === "normal")
      assert.deepEqual(
        actual.data.actualAllocations,
        Object.fromEntries(
          Object.entries((await store.read()).data.actualAllocations).filter(
            ([k]) => k.startsWith(user.resourceId + "|") && !!user.resourceId,
          ),
        ),
      );
    if (user.role === "manager")
      assert.equal(actual.data.revisions["allocation:" + deleted], 2);
  }
  const normal = await store.view(users.normal);
  assert(
    Object.keys(normal.data.actualTeamTotals).length >
      Object.keys(normal.data.actualAllocations).length,
  );
  assert.equal(normal.data.allocations[ownKey], 0);
  assert.equal(Object.hasOwn(normal.data.allocations, deleted), false);
  assert(
    Object.keys(normal.data.actualAllocations).some((k) =>
      k.endsWith("2026-01"),
    ),
  );
  assert(
    Object.keys(normal.data.actualAllocations).some((k) =>
      k.endsWith("2026-07"),
    ),
  );
});

test("planning read uses the current persisted account and team leadership, never caller scope", async (t) => {
  const { store, users, team, other, observations, reference } = await setup(t);
  const spoofed = { ...users.manager, role: "admin", leaders: [other.lead] };
  assert.deepEqual(await store.view(spoofed), await reference(users.manager));
  await store.mutate(users.admin, (d, active) =>
    applyChanges(d, active, [
      {
        kind: "team",
        id: team.id,
        revision: d.revisions["team:" + team.id] || 0,
        value: { ...team, lead: other.lead },
      },
    ]),
  );
  assert.deepEqual(
    await store.view(users.manager),
    await reference(users.manager),
  );
  assert(
    !Object.keys((await store.view(users.manager)).data.allocations).some((k) =>
      k.startsWith(team.id + "|"),
    ),
  );
  await store.transaction((c) =>
    c.query("DELETE FROM kp_user_leaders WHERE user_id=@p0", [
      users.manager._id,
    ]),
  );
  assert.deepEqual(
    await store.view(users.manager),
    await reference(users.manager),
  );
  assert.equal(
    Object.keys((await store.view(users.manager)).data.allocations).length,
    1000,
  );
  await store.transaction((c) =>
    c.query("UPDATE kp_users SET active=0 WHERE id=@p0", [users.manager._id]),
  );
  observations.length = 0;
  await assert.rejects(store.view(users.manager), (e) => e.status === 401);
  assert.equal(observations.length, 0);
});

test("manager mutations still read complete snapshots and retain other teams and deletion revisions", async (t) => {
  const { store, users, team, other, observations, reference } = await setup(t);
  const before = await store.read();
  const key = Object.keys(before.data.allocations).find((k) =>
    k.startsWith(team.id + "|"),
  );
  const hidden = Object.keys(before.data.allocations).find((k) =>
    k.startsWith(other.id + "|"),
  );
  observations.length = 0;
  const result = await store.mutate(
    users.manager,
    (d, active) => {
      assert.deepEqual(d.allocations, before.data.allocations);
      applyChanges(d, active, [
        {
          kind: "allocation",
          id: key,
          revision: d.revisions["allocation:" + key],
          operation: "delete",
        },
      ]);
    },
    { returnView: true },
  );
  assert(observations.length > 0);
  assert(
    observations.every(
      (row) => !row.sql.includes("WHERE") && row.values.length === 0,
    ),
  );
  assert.deepEqual(result, await reference(users.manager));
  const after = await store.read();
  assert.equal(after.generation, before.generation + 1);
  assert.equal(after.data.allocations[hidden], before.data.allocations[hidden]);
  assert.equal(
    after.data.revisions["allocation:" + hidden],
    before.data.revisions["allocation:" + hidden],
  );
  assert.equal(
    after.data.revisions["allocation:" + key],
    before.data.revisions["allocation:" + key] + 1,
  );
  assert.equal(Object.keys(after.data.allocations).length, 999);
});

test("legacy team IDs containing composite separators retain the full-read view semantics", async (t) => {
  const { store, users, team, other, observations, reference } = await setup(t);
  const legacyId = team.id + "|legacy";
  await store.transaction(async (c) => {
    await c.upsert("teams", [
      {
        id: legacyId,
        name: "Legacy",
        leader_name: other.lead,
        manager_name: "",
        excel_capacity: 0,
        catalog: false,
      },
    ]);
    await c.upsert("allocations", [
      {
        team_id: legacyId,
        project_id: "bench-p0",
        month: "2026-01",
        amount: 0.75,
      },
    ]);
  });
  observations.length = 0;
  const actual = await store.view(users.manager);
  assert(observations.every((row) => !row.sql.includes("WHERE")));
  assert.deepEqual(actual, await reference(users.manager));
  assert.equal(actual.data.allocations[legacyId + "|bench-p0|2026-01"], 0.75);
});

test("an assigned leadership without teams returns an empty planning map and ordinary-query fallback matches streaming", async (t) => {
  const { store, users, observations } = await setup(t);
  await store.transaction(async (c) => {
    await c.upsert("leaders", [{ name: "Empty leadership", manager_name: "" }]);
    await c.query("DELETE FROM kp_user_leaders WHERE user_id=@p0", [
      users.manager._id,
    ]);
    await c.upsert("user_leaders", [
      { user_id: users.manager._id, leader_name: "Empty leadership" },
    ]);
  });
  observations.length = 0;
  const view = await store.view(users.manager);
  assert.deepEqual(view.data.allocations, {});
  assert.equal(observations[0].rows, 0);
  assert(observations[0].sql.includes(" WHERE 1=0"));
  await store.transaction(async (c) => {
    const active = view.user;
    const streamed = await store.read(c, active);
    assert.deepEqual(await store.read({ query: c.query }, active), streamed);
    const provider = store.provider;
    try {
      store.provider = "mssql";
      assert.deepEqual(await store.read({ query: c.query }, active), streamed);
    } finally {
      store.provider = provider;
    }
  }, true);
});
