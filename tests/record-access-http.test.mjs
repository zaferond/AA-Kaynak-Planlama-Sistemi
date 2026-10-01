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
