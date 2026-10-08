import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { activeTeamMembers } from "../shared/model.ts";
import {
  DIRECTORY_REVISION_KEY,
  directoryRevision,
} from "../shared/directory-policy.ts";

async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-record-http-"));
  const env = {
    NODE_ENV: "test",
    DB_PROVIDER: "sqljs",
    SQLJS_FILE: path.join(dir, "test.sqlite"),
  };
  const store = new Store({ env });
  const password = "Record-access-test-only-284!";
  const hashed = await hashPassword(password);
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const app = createApp(store, { origin });
  server.on("request", app);
  t.after(async () => {
    app.locals.close();
    await new Promise((resolve) => server.close(resolve));
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  async function request(url, body, auth = {}) {
    const response = await fetch(origin + "/api" + url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: auth.cookie || "",
        ...(body === undefined
          ? {}
          : {
              Origin: origin,
              "Content-Type": "application/json",
              "X-Requested-With": "KaynakPortal",
              "X-CSRF-Token": auth.csrf || "",
            }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json(), response };
  }
  async function user(id, role = "admin", resourceId = "", leaders = []) {
    await store.bootstrapUser({
      _id: id,
      username: "record." + id,
      name: id,
      role,
      resourceId,
      leaders,
      active: true,
      password: hashed,
      revision: 1,
      version: 1,
    });
    const result = await request("/auth/login", {
      username: "record." + id,
      password,
    });
    assert.equal(result.status, 200);
    return {
      cookie: result.response.headers.get("set-cookie").split(";")[0],
      csrf: result.json.csrf,
    };
  }
  const admin = await user("admin");
  async function state() {
    const result = await request("/data", undefined, admin);
    assert.equal(result.status, 200);
    return result.json;
  }
  async function write(changes, auth = admin) {
    const current = await state();
    return request(
      "/changes",
      {
        changes: changes.map((change) => ({
          revision: current.data.revisions[change.kind + ":" + change.id] || 0,
          ...change,
        })),
      },
      auth,
    );
  }
  return { store, env, admin, request, user, state, write };
}
const risk = (id) => ({
  id,
  projectId: id,
  reportedBy: "Team",
  category: "Teknik",
  reportedAt: "2026-09-01",
  system: "System",
  description: "Risk " + id,
  cause: "Cause",
  actionPlan: "Plan",
  targetAt: "",
  status: "Açık",
  owner: "Owner",
  likelihood: 2,
  impact: 3,
  strategy: "Kontrol",
  implementedAt: "",
  actionResult: "",
  residualLikelihood: null,
  residualImpact: null,
});

test("numeric and personal deletions validate targets without manufacturing revision tombstones", async (t) => {
  const { store, user, state, write } = await setup(t);
  const team = (await state()).data.teams.find((item) => item.lead);
  assert.equal(
    (
      await write([
        {
          kind: "project",
          id: "p",
          value: {
            id: "p",
            name: "Synthetic project",
            start: "2026-01",
            end: "2026-12",
            phases: {},
          },
        },
        {
          kind: "resource",
          id: "r-own",
          value: {
            id: "r-own",
            name: "Synthetic employee",
            note: "",
            versions: [
              {
                team: team.id,
                lead: team.lead,
                effective: "2026-01",
                start: "2026-01-01",
                end: "",
                status: "Aktif Çalışan",
                included: true,
                amount: 1,
              },
            ],
          },
        },
      ])
    ).status,
    200,
  );
  const owner = await user("delete-owner", "normal", "r-own");
  const foreign = await user("delete-foreign", "normal");
  const manager = await user("delete-manager", "manager", "", [team.lead]);
  const sqlRevisions = async () =>
    (await store.db.query("SELECT * FROM kp_revisions ORDER BY kind,record_id"))
      .rows;
  const del = (kind, id) => ({ kind, id, operation: "delete" });

  await t.test(
    "the original 32-command phantom-project attack is rejected atomically",
    async () => {
      const before = await state(),
        revisions = await sqlRevisions();
      const ids = [
        ...Array.from({ length: 30 }, (_, i) => `r-own|ghost-${i}|2026-01`),
        "r-own|ghost-missing-month",
        "r-own|ghost-extra|2026-01|extra",
      ];
      assert.equal(
        (
          await write(
            ids.map((id) => del("actual", id)),
            owner,
          )
        ).status,
        404,
      );
      assert.deepEqual(await state(), before);
      assert.deepEqual(await sqlRevisions(), revisions);
    },
  );

  await t.test(
    "malformed dates, missing owners/projects and extra components cannot bypass validation by deletion",
    async () => {
      const before = await state(),
        revisions = await sqlRevisions();
      const cases = [
        ["actual", "r-own|p", 400, owner],
        ["actual", "r-own|p|2026-01|extra", 400, owner],
        ["actual", "r-own||2026-01", 400, owner],
        ["actual", "r-own|p|2200-01", 400, owner],
        ["actual", "missing|p|2026-01", 404],
        ["allocation", `${team.id}|missing|2026-01`, 404, manager],
        ["allocation", `${team.id}|p|2026-13`, 400, manager],
        ["allocation", "missing|p|2026-01", 404],
        ["workedHours", "r-own|1999-12", 400, owner],
        ["workedHours", "r-own|2026-01|extra", 400, owner],
        ["workedHours", "missing|2026-01", 404],
        ["personDay", "r-own|2026-02-30|leave", 400, owner],
        ["personDay", "r-own|2200-01-01|leave", 400, owner],
        ["personDay", "r-own|2026-01-05|leave|extra", 400, owner],
        ["personDay", "missing|2026-01-05|leave", 400],
      ];
      for (const [kind, id, expected, auth] of cases)
        assert.equal(
          (await write([del(kind, id)], auth)).status,
          expected,
          `${kind}:${id}`,
        );
      assert.equal(
        (
          await write(
            [{ kind: "workedHours", id: "r-own|2200-01", value: null }],
            owner,
          )
        ).status,
        400,
      );
      assert.deepEqual(await state(), before);
      assert.deepEqual(await sqlRevisions(), revisions);
    },
  );

  const records = [
    ["allocation", `${team.id}|p|2026-01`, "allocations", 0, manager],
    [
      "actual",
      "r-own|p|2026-01",
      "actualAllocations",
      { unit: "percent", value: 25 },
      owner,
    ],
    ["workedHours", "r-own|2026-01", "actualWorkedHours", 0, owner],
    [
      "personDay",
      "r-own|2026-01-05|leave",
      "personCalendar",
      { type: "leave", hours: 1, label: "Synthetic" },
      owner,
    ],
  ];
  await t.test(
    "empty clears and automatic-hour resets succeed without new revision rows; authorization still applies",
    async () => {
      const before = (await state()).data,
        revisions = await sqlRevisions();
      for (const [kind, id, , , auth] of records) {
        assert.equal((await write([del(kind, id)], foreign)).status, 403);
        assert.equal((await write([del(kind, id)], auth)).status, 200);
      }
      assert.equal(
        (
          await write(
            [{ kind: "workedHours", id: "r-own|2026-01", value: null }],
            owner,
          )
        ).status,
        200,
      );
      assert.deepEqual((await state()).data, before);
      assert.deepEqual(await sqlRevisions(), revisions);
    },
  );

  await t.test(
    "real deletions (including zero) retain tombstones, reject stale writes and allow recreation",
    async () => {
      for (const [kind, id, collection, value, auth] of records) {
        assert.equal((await write([{ kind, id, value }], auth)).status, 200);
        const revision = (await state()).data.revisions[kind + ":" + id];
        const remove =
          kind === "workedHours" ? { kind, id, value: null } : del(kind, id);
        assert.equal((await write([remove], auth)).status, 200);
        const removed = (await state()).data;
        assert.equal(Object.hasOwn(removed[collection], id), false);
        if (kind === "actual")
          assert.equal(Object.hasOwn(removed.actualPercentEntries, id), false);
        assert.equal(removed.revisions[kind + ":" + id], revision + 1);
        assert.equal(
          (await write([{ ...remove, revision }], auth)).status,
          409,
        );
        assert.equal(
          (await write([{ kind, id, value, revision }], auth)).status,
          409,
        );
        const rows = await sqlRevisions();
        assert.equal((await write([remove], auth)).status, 200);
        assert.deepEqual(await sqlRevisions(), rows);
        assert.equal((await write([{ kind, id, value }], auth)).status, 200);
        assert.equal(
          (await state()).data.revisions[kind + ":" + id],
          revision + 2,
        );
        assert.equal((await write([remove], auth)).status, 200);
      }
    },
  );

  await t.test(
    "a rejected deletion rolls back earlier valid changes in the same batch",
    async () => {
      const before = await state(),
        revisions = await sqlRevisions();
      assert.equal(
        (
          await write(
            [
              { kind: "actual", id: "r-own|p|2026-01", value: 0.1 },
              del("actual", "r-own|missing|2026-01"),
            ],
            owner,
          )
        ).status,
        404,
      );
      assert.deepEqual(await state(), before);
      assert.deepEqual(await sqlRevisions(), revisions);
    },
  );
});

test("manual leadership and team HTTP CRUD survives reload/reopen and guards roles, duplicates and stale drafts", async (t) => {
  const { store, env, admin, request, user, state, write } = await setup(t);
  const normal = await user("directory-normal", "normal");
  const manager = await user("directory-manager", "manager");
  const changeLeader = async (input, auth = admin) =>
    request(
      "/leaders/change",
      {
        generation: (await state()).generation,
        ...input,
      },
      auth,
    );
  const leader = {
    action: "create",
    name: "Manual Leadership",
    managerName: "Synthetic manager",
  };
  for (const auth of [normal, manager]) {
    assert.equal((await changeLeader(leader, auth)).status, 403);
    assert.equal(
      (
        await write(
          [
            {
              kind: "team",
              id: "manual-t",
              value: {
                id: "manual-t",
                name: "Manual Team",
                lead: "",
                excelCapacity: 0,
              },
            },
          ],
          auth,
        )
      ).status,
      403,
    );
  }
  assert.equal((await changeLeader(leader)).status, 200);
  assert.equal(
    (await changeLeader({ ...leader, name: "  manual leadership  " })).status,
    400,
  );
  assert.equal(
    (await changeLeader({ action: "create", name: "İLERİ" })).status,
    200,
  );
  assert.equal(
    (await changeLeader({ action: "create", name: "ileri" })).status,
    400,
  );
  const value = {
    id: "manual-t",
    name: "Manual Team",
    lead: leader.name,
    managerName: "Synthetic team manager",
    excelCapacity: 0,
  };
  assert.equal(
    (await write([{ kind: "team", id: value.id, value }])).status,
    200,
  );
  let current = await state();
  assert.equal(current.data.teams.find((t) => t.id === value.id).catalog, true);
  assert.equal(
    (
      await write([
        {
          kind: "team",
          id: "duplicate",
          value: { ...value, id: "duplicate", name: "manual team" },
        },
      ])
    ).status,
    400,
  );
  assert.equal(
    (
      await changeLeader({
        action: "update",
        name: leader.name,
        newName: "Renamed Leadership",
        managerName: "Updated manager",
      })
    ).status,
    200,
  );
  current = await state();
  assert.equal(
    current.data.teams.find((t) => t.id === value.id).lead,
    "Renamed Leadership",
  );
  const pinned = current.data.revisions["team:" + value.id];
  const updated = {
    ...current.data.teams.find((t) => t.id === value.id),
    name: "Renamed Team",
  };
  assert.equal(
    (await write([{ kind: "team", id: value.id, value: updated }])).status,
    200,
  );
  assert.equal(
    (
      await write([
        {
          kind: "team",
          id: value.id,
          value: { ...updated, name: "Stale Team" },
          revision: pinned,
        },
      ])
    ).status,
    409,
  );
  assert.equal(
    (
      await changeLeader({
        action: "delete",
        name: "Renamed Leadership",
        generation: current.generation,
      })
    ).status,
    409,
  );
  assert.equal(
    (await state()).data.leaderManagers["Renamed Leadership"],
    "Updated manager",
  );
  assert.equal(
    (await changeLeader({ action: "delete", name: "Renamed Leadership" }))
      .status,
    200,
  );
  current = await state();
  assert(!current.data.teams.some((t) => t.id === value.id));
  assert(!current.data.leaders.includes("Renamed Leadership"));
  assert.equal((await store.read()).data.leaders.includes("İLERİ"), true);
  await store.close();
  const reopened = new Store({ env });
  try {
    await reopened.connect();
    const persisted = (await reopened.read()).data;
    assert(persisted.leaders.includes("İLERİ"));
    assert(!persisted.leaders.includes("Renamed Leadership"));
    assert(!persisted.teams.some((t) => t.id === value.id));
  } finally {
    await reopened.close();
  }
});

test("leadership catalog revision ignores unrelated writes but rejects concurrent catalog drafts and survives reopen", async (t) => {
  const { store, env, admin, request, user, state, write } = await setup(t);
  const change = (body, auth = admin) => request("/leaders/change", body, auth);
  const initial = await state();
  assert.equal(directoryRevision(initial.data), 0);
  const create = { action: "create", name: "Catalog test", catalogRevision: 0 };
  for (const role of ["normal", "manager"]) {
    const auth = await user("catalog-" + role, role);
    assert.equal((await change(create, auth)).status, 403);
  }
  assert.equal(
    (await change({ action: "create", name: "Missing token" })).status,
    400,
  );
  assert.equal((await change({ ...create, catalogRevision: -1 })).status, 400);
  assert.equal((await change(create)).status, 200);
  const opened = await state();
  assert.equal(directoryRevision(opened.data), 1);
  const project = {
    id: "catalog-project",
    name: "Unrelated project",
    start: "2026-01",
    end: "2026-12",
    phases: {},
    phaseColors: {},
    milestones: [],
  };
  assert.equal(
    (await write([{ kind: "project", id: project.id, value: project }])).status,
    200,
  );
  assert.equal(
    (await write([{ kind: "risk", id: project.id, value: risk(project.id) }]))
      .status,
    200,
  );
  const team = opened.data.teams.find((team) => team.lead);
  assert.equal(
    (
      await write([
        {
          kind: "allocation",
          id: team.id + "|" + project.id + "|2026-01",
          value: 1,
        },
      ])
    ).status,
    200,
  );
  assert.equal(directoryRevision((await state()).data), 1);
  const draft = {
    action: "update",
    name: create.name,
    managerName: "Saved manager",
    generation: opened.generation,
    catalogRevision: 1,
  };
  const legacy = { ...draft };
  delete legacy.catalogRevision;
  const legacyConflict = await change(legacy);
  assert.equal(legacyConflict.status, 409);
  assert.match(legacyConflict.json.error, /Uygulama verileri değişti/);
  assert.equal((await change(draft)).status, 200);
  assert.equal(directoryRevision((await state()).data), 2);
  const teamOpened = await state();
  assert.equal(
    (
      await write([
        {
          kind: "team",
          id: team.id,
          value: { ...team, name: team.name + " updated" },
        },
      ])
    ).status,
    200,
  );
  assert.equal(directoryRevision((await state()).data), 3);
  const stale = await change({
    ...draft,
    managerName: "Stale manager",
    catalogRevision: directoryRevision(teamOpened.data),
  });
  assert.equal(stale.status, 409);
  assert.match(stale.json.error, /Liderlik veya takım listesi değişti/);
  assert.equal(
    (await state()).data.leaderManagers[create.name],
    "Saved manager",
  );
  const revision = directoryRevision((await state()).data);
  const secondAdmin = await user("second-admin");
  const results = await Promise.all([
    change({
      action: "create",
      name: "Concurrent A",
      catalogRevision: revision,
    }),
    change(
      { action: "create", name: "Concurrent B", catalogRevision: revision },
      secondAdmin,
    ),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const current = await state();
  assert.equal(directoryRevision(current.data), revision + 1);
  await store.close();
  const reopened = new Store({ env });
  try {
    await reopened.connect();
    assert.equal(directoryRevision((await reopened.read()).data), revision + 1);
  } finally {
    await reopened.close();
  }
});

test("catalog revisions resist failed batches, delete/recreate ABA and identical JSON restore", async (t) => {
  const { admin, request, state, write } = await setup(t);
  const change = (body) => request("/leaders/change", body, admin);
  const start = await state();
  const team = start.data.teams.find((team) => team.lead);
  const failed = await write([
    { kind: "team", id: team.id, value: { ...team, name: "Must roll back" } },
    { kind: "project", id: "invalid", value: { id: "wrong" } },
  ]);
  assert.equal(failed.status, 400);
  assert.deepEqual(await state(), start);
  const create = { action: "create", name: "ABA catalog", catalogRevision: 0 };
  assert.equal((await change(create)).status, 200);
  assert.equal(
    (await change({ action: "delete", name: create.name, catalogRevision: 1 }))
      .status,
    200,
  );
  assert.equal((await change({ ...create, catalogRevision: 2 })).status, 200);
  assert.equal(
    (
      await change({
        action: "update",
        name: create.name,
        managerName: "Old draft",
        catalogRevision: 1,
      })
    ).status,
    409,
  );
  const before = await state();
  const backup = (await request("/backup", undefined, admin)).json.data;
  backup.revisions[DIRECTORY_REVISION_KEY] = 999999;
  assert.equal(
    (
      await request(
        "/restore",
        { data: backup, generation: before.generation },
        admin,
      )
    ).status,
    200,
  );
  const after = await state();
  assert.equal(
    directoryRevision(after.data),
    directoryRevision(before.data) + 1,
  );
  assert.equal(
    (
      await change({
        action: "delete",
        name: create.name,
        catalogRevision: directoryRevision(before.data),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await change({
        action: "delete",
        name: create.name,
        catalogRevision: directoryRevision(after.data),
      })
    ).status,
    200,
  );
});

test("manual team moves preserve allocations and historical resource links; used records cannot be deleted", async (t) => {
  const { store, env, admin, request, state, write } = await setup(t);
  async function leader(input) {
    return request(
      "/leaders/change",
      { generation: (await state()).generation, ...input },
      admin,
    );
  }
  for (const name of ["Manual A", "Manual B"])
    assert.equal((await leader({ action: "create", name })).status, 200);
  const team = {
    id: "linked-team",
    name: "Linked team",
    lead: "Manual A",
    excelCapacity: 0,
  };
  assert.equal(
    (
      await write([
        { kind: "team", id: team.id, value: team },
        {
          kind: "project",
          id: "linked-project",
          value: {
            id: "linked-project",
            name: "Synthetic project",
            start: "2026-01",
            end: "2026-12",
            phases: {},
          },
        },
        {
          kind: "resource",
          id: "linked-resource",
          value: {
            id: "linked-resource",
            name: "Synthetic employee",
            note: "",
            versions: [
              {
                team: team.id,
                lead: team.lead,
                effective: "2026-01",
                start: "2026-01-01",
                end: "",
                status: "Aktif Çalışan",
                included: true,
                amount: 1,
              },
            ],
          },
        },
        {
          kind: "allocation",
          id: team.id + "|linked-project|2026-01",
          value: 0.5,
        },
      ])
    ).status,
    200,
  );
  const before = await state();
  assert.equal(
    (
      await write([
        {
          kind: "team",
          id: team.id,
          value: { ...team, name: "Moved team", lead: "Manual B" },
        },
      ])
    ).status,
    200,
  );
  let after = await state();
  assert.equal(
    after.data.resources.find((r) => r.id === "linked-resource").versions[0]
      .lead,
    "Manual B",
  );
  assert.equal(
    after.data.revisions["resource:linked-resource"],
    before.data.revisions["resource:linked-resource"] + 1,
  );
  assert.deepEqual(after.data.allocations, before.data.allocations);
  const snapshot = structuredClone(after);
  assert.equal(
    (
      await write([
        { kind: "team", id: team.id, operation: "delete", value: null },
      ])
    ).status,
    409,
  );
  assert.equal(
    (await leader({ action: "delete", name: "Manual B" })).status,
    409,
  );
  after = await state();
  assert.deepEqual(
    after,
    snapshot,
    "rejected deletes must roll back all data and generation",
  );
  await store.close();
  const reopened = new Store({ env });
  try {
    await reopened.connect();
    const persisted = (await reopened.read()).data;
    assert.equal(
      persisted.teams.find((t) => t.id === team.id).name,
      "Moved team",
    );
    assert.equal(
      persisted.teams.find((t) => t.id === team.id).lead,
      "Manual B",
    );
    assert.equal(persisted.teams.find((t) => t.id === team.id).catalog, true);
    assert.equal(
      persisted.resources.find((r) => r.id === "linked-resource").versions[0]
        .lead,
      "Manual B",
    );
    assert.deepEqual(persisted.allocations, before.data.allocations);
  } finally {
    await reopened.close();
  }
});

test("HTTP CRUD with prototype-like team/project/resource/risk IDs preserves permissions, cascade revisions and account links", async (t) => {
  const { store, admin, request, user, state, write } = await setup(t);
  const initial = await state();
  const team = initial.data.teams.find((item) => item.lead);
  const other = initial.data.teams.find(
    (item) => item.lead && item.lead !== team.lead,
  );
  const ids = ["constructor", "toString", "__proto__"];
  const key = (id) => id + "|" + id + "|2026-09";
  const created = await write(
    ids.flatMap((id) => [
      {
        kind: "team",
        id,
        value: {
          id,
          name: "Team " + id,
          lead: team.lead,
          excelCapacity: 0,
          catalog: true,
        },
      },
      {
        kind: "project",
        id,
        value: {
          id,
          name: "Project " + id,
          start: "2026-01",
          end: "2026-12",
          phases: { "2026-09": "Analysis" },
        },
      },
      {
        kind: "resource",
        id,
        value: {
          id,
          name: "Person " + id,
          note: "Private",
          versions: [
            {
              team: id,
              lead: team.lead,
              effective: "2026-01",
              status: "Aktif Çalışan",
              included: true,
              start: "2026-01-01",
              end: "",
              amount: 1,
            },
          ],
        },
      },
      { kind: "allocation", id: key(id), value: 0.5 },
      { kind: "actual", id: key(id), value: 0.25 },
      { kind: "workedHours", id: id + "|2026-09", value: 180 },
      {
        kind: "personDay",
        id: id + "|2026-09-01|leave",
        value: { type: "leave", hours: 2, label: "Private absence" },
      },
    ]),
  );
  assert.equal(created.status, 200);
  const members = activeTeamMembers(created.json.data, "2026-09");
  for (const id of ids) assert.deepEqual(members[id], ["Person " + id]);
  const owner = await user("owner", "normal", "constructor");
  const outsider = await user("outsider", "normal", "toString");
  const manager = await user("manager", "manager", "", [team.lead]);
  for (const id of ids) {
    assert.equal(
      (await write([{ kind: "risk", id, value: risk(id) }], owner)).status,
      200,
    );
    const value = (await state()).data.risks.find((item) => item.id === id);
    assert.equal(
      (
        await write(
          [
            {
              kind: "risk",
              id,
              value: { ...value, description: "Owner update" },
            },
          ],
          outsider,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await write(
          [
            {
              kind: "risk",
              id,
              value: { ...value, description: "Owner update" },
            },
          ],
          owner,
        )
      ).status,
      200,
    );
    const latest = (await state()).data.risks.find((item) => item.id === id);
    assert.equal(
      (
        await write(
          [
            {
              kind: "risk",
              id,
              value: { ...latest, description: "Manager update" },
            },
          ],
          manager,
        )
      ).status,
      200,
    );
  }
  assert.equal(
    (
      await write(
        [
          {
            kind: "actual",
            id: key("constructor"),
            value: { unit: "percent", value: 20 },
          },
        ],
        owner,
      )
    ).status,
    200,
  );
  assert.equal(
    (await write([{ kind: "actual", id: key("toString"), value: 0.1 }], owner))
      .status,
    403,
  );
  assert.equal(
    (
      await write(
        [
          {
            kind: "allocation",
            id: other.id + "|constructor|2026-09",
            value: 0.2,
          },
        ],
        manager,
      )
    ).status,
    403,
  );
  const before = await state();
  assert.equal(
    (
      await write(
        [{ kind: "actual", id: key("constructor"), value: 0.1, revision: 1 }],
        owner,
      )
    ).status,
    409,
  );
  assert.deepEqual(await state(), before);
  assert.equal(
    (await write([{ kind: "team", id: "constructor", operation: "delete" }]))
      .status,
    409,
  );
  assert.equal(
    (
      await write(
        [{ kind: "risk", id: "constructor", operation: "delete" }],
        owner,
      )
    ).status,
    403,
  );
  const savedRisk = before.data.risks.find((item) => item.id === "constructor");
  assert.equal(
    (await write([{ kind: "project", id: "constructor", operation: "delete" }]))
      .status,
    200,
  );
  const deleted = await state();
  assert(!deleted.data.risks.some((item) => item.id === "constructor"));
  assert.equal(
    deleted.data.revisions["risk:constructor"],
    before.data.revisions["risk:constructor"] + 1,
  );
  assert(!Object.hasOwn(deleted.data.allocations, key("constructor")));
  assert(!Object.hasOwn(deleted.data.actualAllocations, key("constructor")));
  assert.equal(
    (
      await write([
        {
          kind: "project",
          id: "constructor",
          value: before.data.projects.find((item) => item.id === "constructor"),
        },
      ])
    ).status,
    200,
  );
  const recreated = await state();
  const stale = await write(
    [
      {
        kind: "risk",
        id: "constructor",
        value: savedRisk,
        revision: before.data.revisions["risk:constructor"],
      },
    ],
    owner,
  );
  assert.equal(stale.status, 409);
  assert.deepEqual(await state(), recreated);
  assert.equal(
    (
      await write([
        { kind: "resource", id: "constructor", operation: "delete" },
      ])
    ).status,
    200,
  );
  const removed = await state();
  assert(!removed.data.resources.some((item) => item.id === "constructor"));
  assert(!Object.hasOwn(removed.data.actualWorkedHours, "constructor|2026-09"));
  assert(
    !Object.hasOwn(removed.data.personCalendar, "constructor|2026-09-01|leave"),
  );
  assert.equal((await store.findUser({ id: "owner" })).resourceId, "");
  const currentOwner = await request("/auth/me", undefined, owner);
  assert.equal(currentOwner.status, 200);
  assert.equal(currentOwner.json.user.resourceId, "");
  assert.equal(
    (
      await write(
        [{ kind: "actual", id: key("constructor"), value: 0.1 }],
        owner,
      )
    ).status,
    403,
  );
  assert.equal(
    (await write([{ kind: "team", id: "constructor", operation: "delete" }]))
      .status,
    200,
  );
  const final = await state();
  for (const id of ["toString", "__proto__"]) {
    assert(final.data.teams.some((item) => item.id === id));
    assert(final.data.risks.some((item) => item.id === id));
    assert.equal(final.data.allocations[key(id)], 0.5);
  }
  const history = await request("/audit?limit=100", undefined, admin);
  assert.equal(history.status, 200);
  assert(!JSON.stringify(history.json).includes("[native code]"));
  assert(!JSON.stringify(history.json).includes("Private absence"));
});

test("HTTP leadership rename and manager updates support __proto__, survive backup/restart and retain account scopes", async (t) => {
  const { store, env, admin, request, user, state } = await setup(t);
  const initial = await state();
  const original = initial.data.teams.find((item) => item.lead).lead;
  await user("manager", "manager", "", [original]);
  async function change(body) {
    const current = await state();
    return request(
      "/leaders/change",
      { generation: current.generation, ...body },
      admin,
    );
  }
  assert.equal(
    (
      await change({
        action: "rename",
        name: original,
        newName: "constructor",
        managerName: "",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await change({
        action: "rename",
        name: "constructor",
        newName: "__proto__",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await change({
        action: "update",
        name: "__proto__",
        managerName: "Manager",
      })
    ).status,
    200,
  );
  const updated = await state();
  assert.equal(updated.data.leaderManagers.__proto__, "Manager");
  assert.equal(Object.hasOwn(updated.data.leaderManagers, "__proto__"), true);
  assert.deepEqual((await store.findUser({ id: "manager" })).leaders, [
    "__proto__",
  ]);
  const backup = await request("/backup", undefined, admin);
  assert.equal(backup.status, 200);
  assert.equal(backup.json.data.leaderManagers.__proto__, "Manager");
  const restored = await request(
    "/restore",
    { generation: updated.generation, data: backup.json.data },
    admin,
  );
  assert.equal(restored.status, 200);
  assert.equal(restored.json.data.leaderManagers.__proto__, "Manager");
  const invalid = structuredClone(backup.json.data);
  Object.defineProperty(invalid.leaderManagers, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    writable: true,
  });
  const before = await state();
  const invalidRestore = await request(
    "/restore",
    { generation: before.generation, data: invalid },
    admin,
  );
  assert.equal(invalidRestore.status, 400);
  assert.deepEqual(await state(), before);
  assert.equal(Object.prototype.polluted, undefined);
  await store.close();
  const reopened = new Store({ env });
  try {
    await reopened.connect();
    const data = (await reopened.read()).data;
    assert.equal(Object.getPrototypeOf(data.leaderManagers), Object.prototype);
    assert.equal(data.leaderManagers.__proto__, "Manager");
    assert.deepEqual((await reopened.findUser({ id: "manager" })).leaders, [
      "__proto__",
    ]);
  } finally {
    await reopened.close();
  }
});

test("HTTP session identity is stable for one session, rotates on login without generation changes, and grants no authentication", async (t) => {
  const { admin, request, user, state } = await setup(t);
  const before = await state();
  const me = await request("/auth/me", undefined, admin);
  const marker = me.json.sessionIdentity;
  assert.match(marker, /^[a-f0-9]{64}$/);
  assert.equal(me.response.headers.get("X-Session-Identity"), marker);
  assert.notEqual(marker, admin.csrf);
  const version = await request("/version", undefined, admin);
  assert.equal(version.json.sessionIdentity, marker);
  assert.equal(version.json.generation, before.generation);
  assert.equal(
    (await request("/data", undefined, admin)).response.headers.get(
      "X-Session-Identity",
    ),
    marker,
  );
  const next = await user("admin");
  const nextVersion = await request("/version", undefined, next);
  assert.notEqual(nextVersion.json.sessionIdentity, marker);
  assert.equal(nextVersion.json.generation, before.generation);
  const denied = await request(
    "/changes",
    { changes: [] },
    { cookie: next.cookie, csrf: admin.csrf },
  );
  assert.equal(denied.status, 403);
  assert.equal(
    denied.response.headers.get("X-Session-Identity"),
    nextVersion.json.sessionIdentity,
  );
  assert.deepEqual((await state()).data, before.data);
  const forgery = await request("/auth/me", undefined, {
    cookie: "kp_session=" + marker,
  });
  assert.equal(forgery.status, 401);
  assert.equal(forgery.response.headers.get("X-Session-Identity"), null);
});
