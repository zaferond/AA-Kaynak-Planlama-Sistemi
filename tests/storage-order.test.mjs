import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

let counter = 0;
async function setup(t) {
  const storage = await import("../frontend/src/storage.ts?test=" + counter++);
  const pending = [];
  t.mock.method(
    globalThis,
    "fetch",
    (url, options) =>
      new Promise((resolve) => pending.push({ url, options, resolve })),
  );
  const reply = (path, result, status = 200) => {
    const index = pending.findIndex((item) => item.url === "/api" + path);
    assert(index >= 0, "pending request " + path);
    pending
      .splice(index, 1)[0]
      .resolve({ ok: status < 400, status, json: async () => result });
  };
  return { storage, pending, reply };
}

test("late background reads return the latest accepted data and cannot roll back generation or permissions", async (t) => {
  const { storage, reply } = await setup(t);
  const oldRead = storage.readLocal();
  const write = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 1, revision: 0 },
  ]);
  await setImmediate();
  const user = { id: "u", role: "normal", name: "Current" };
  reply("/changes", { generation: 2, data: { marker: "new" }, user });
  assert.deepEqual(await write, { marker: "new" });
  reply("/data", {
    generation: 1,
    data: { marker: "old" },
    user: { ...user, role: "admin" },
  });
  assert.deepEqual(await oldRead, { marker: "new" });
  assert.equal(storage.currentUser().role, "normal");
  const check = storage.checkUpdates();
  reply("/version", { generation: 2 });
  assert.equal(await check, false);
});

test("out-of-order administrative and batch responses use the newest snapshot", async (t) => {
  const { storage, reply } = await setup(t);
  const userEdit = storage.saveUser({
    id: "u",
    role: "normal",
    resourceId: "r",
    leaders: [],
    revision: 1,
  });
  const batch = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 1, revision: 0 },
  ]);
  await setImmediate();
  reply("/changes", { generation: 4, data: { marker: "latest" } });
  await batch;
  reply("/users", { generation: 3, data: { marker: "older" } });
  assert.deepEqual(await userEdit, { marker: "latest" });
});

test("responses from a previous session never enter the new session cache", async (t) => {
  const { storage, reply } = await setup(t);
  const oldRead = storage.readLocal();
  const rejected = assert.rejects(
    oldRead,
    (error) => error.name === "StaleSessionError",
  );
  const login = storage.login("new.user", "unused");
  reply("/auth/login", {
    user: { id: "new", role: "normal" },
    csrf: "new-csrf",
  });
  await login;
  const newRead = storage.readLocal();
  reply("/data", {
    generation: 99,
    data: { marker: "old-admin" },
    user: { id: "old", role: "admin" },
  });
  await rejected;
  reply("/data", {
    generation: 1,
    data: { marker: "new-user" },
    user: { id: "new", role: "normal" },
  });
  assert.deepEqual(await newRead, { marker: "new-user" });
  assert.equal(storage.currentUser().id, "new");
});

test("an old session 401 cannot expire a new login", async (t) => {
  const { storage, reply } = await setup(t);
  const old = storage.readLocal();
  const rejected = assert.rejects(
    old,
    (error) => error.name === "StaleSessionError",
  );
  const login = storage.login("new.user", "unused");
  reply("/auth/login", { user: { id: "new", role: "normal" }, csrf: "new" });
  await login;
  reply("/data", { error: "Old session" }, 401);
  await rejected;
  assert.equal(storage.currentUser().id, "new");
});

test("a delayed version response does not trigger a reload after a newer write", async (t) => {
  const { storage, reply } = await setup(t);
  const check = storage.checkUpdates();
  const read = storage.readLocal();
  reply("/data", { generation: 3, data: { marker: "current" } });
  await read;
  reply("/version", { generation: 2 });
  assert.equal(await check, false);
});

const planningUser = { id: "u", role: "admin", name: "Current", leaders: [] };
const planningData = () => ({
  marker: "metadata",
  projects: [{ id: "p" }],
  allocations: { "t|p|2026-09": 1 },
  revisions: { "allocation:t|p|2026-09": 1, "project:p": 3 },
});
const planningPatch = (baseGeneration, entries, user = planningUser) => ({
  responseMode: "planning-delta-v1",
  baseGeneration,
  generation: baseGeneration + 1,
  user,
  allocations: entries,
});
async function loadPlanning(storage, reply, generation = 1) {
  const read = storage.readLocal();
  const data = planningData();
  reply("/data", { generation, data, user: planningUser });
  await read;
  return data;
}

test("queued cell writes negotiate their latest base and merge zero/delete without mutating displayed data", async (t) => {
  const { storage, reply, pending } = await setup(t);
  const original = await loadPlanning(storage, reply);
  const first = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 0, revision: 1 },
  ]);
  const second = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-10", value: 0.5, revision: 0 },
  ]);
  await setImmediate();
  assert.equal(pending.length, 1);
  assert.equal(JSON.parse(pending[0].options.body).baseGeneration, 1);
  reply(
    "/changes",
    planningPatch(1, [{ id: "t|p|2026-09", value: 0, revision: 2 }]),
  );
  const next = await first;
  assert.equal(next.allocations["t|p|2026-09"], 0);
  assert.equal(original.allocations["t|p|2026-09"], 1);
  await setImmediate();
  assert.equal(JSON.parse(pending[0].options.body).baseGeneration, 2);
  reply(
    "/changes",
    planningPatch(2, [
      { id: "t|p|2026-09", value: null, revision: 3 },
      { id: "t|p|2026-10", value: 0.5, revision: 1 },
    ]),
  );
  const final = await second;
  assert.equal(Object.hasOwn(final.allocations, "t|p|2026-09"), false);
  assert.equal(final.revisions["allocation:t|p|2026-09"], 3);
  assert.equal(final.allocations["t|p|2026-10"], 0.5);
  assert.equal(final.projects, original.projects);
  assert.equal(pending.length, 0);
});

test("a delayed delta cannot overwrite a newer background snapshot or its principal", async (t) => {
  const { storage, reply, pending } = await setup(t);
  await loadPlanning(storage, reply);
  const write = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 2, revision: 1 },
  ]);
  await setImmediate();
  const read = storage.readLocal();
  const current = { ...planningData(), marker: "newer" };
  reply("/data", {
    generation: 4,
    data: current,
    user: { ...planningUser, role: "manager" },
  });
  await read;
  reply(
    "/changes",
    planningPatch(1, [{ id: "t|p|2026-09", value: 2, revision: 2 }]),
  );
  assert.deepEqual(await write, current);
  assert.equal(storage.currentUser().role, "manager");
  assert.equal(pending.length, 0);
});

test("incompatible deltas fetch a full view once and never repeat the committed write", async (t) => {
  const { storage, reply, pending } = await setup(t);
  await loadPlanning(storage, reply);
  const write = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 2, revision: 1 },
  ]);
  await setImmediate();
  reply(
    "/changes",
    planningPatch(3, [{ id: "t|p|2026-09", value: 2, revision: 2 }]),
  );
  await setImmediate();
  assert.deepEqual(
    pending.map((item) => item.url),
    ["/api/data"],
  );
  const data = { ...planningData(), marker: "recovered" };
  reply("/data", { generation: 4, data, user: planningUser });
  assert.deepEqual(await write, data);
  assert.equal(pending.length, 0);
});

test("entity writes and old servers retain full snapshots; missing caches do not request a delta", async (t) => {
  const { storage, reply, pending } = await setup(t);
  const first = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 1, revision: 0 },
  ]);
  await setImmediate();
  assert.equal(JSON.parse(pending[0].options.body).responseMode, undefined);
  reply("/changes", {
    generation: 1,
    data: planningData(),
    user: planningUser,
  });
  await first;
  const second = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 0, revision: 1 },
  ]);
  await setImmediate();
  assert.equal(
    JSON.parse(pending[0].options.body).responseMode,
    "planning-delta-v1",
  );
  const oldServer = { ...planningData(), marker: "old server" };
  reply("/changes", { generation: 2, data: oldServer, user: planningUser });
  assert.deepEqual(await second, oldServer);
  const mixed = storage.writeBatch([
    { kind: "project", id: "p", value: null, revision: 3 },
  ]);
  await setImmediate();
  assert.equal(JSON.parse(pending[0].options.body).responseMode, undefined);
  reply("/changes", {
    generation: 3,
    data: planningData(),
    user: planningUser,
  });
  await mixed;
});

test("a delta from a previous session is rejected before parsing or fetching recovery data", async (t) => {
  const { storage, reply, pending } = await setup(t);
  await loadPlanning(storage, reply);
  const write = storage.writeBatch([
    { kind: "allocation", id: "t|p|2026-09", value: 2, revision: 1 },
  ]);
  const rejected = assert.rejects(
    write,
    (error) => error.name === "StaleSessionError",
  );
  await setImmediate();
  const login = storage.login("new.user", "unused");
  reply("/auth/login", { user: { id: "new", role: "normal" }, csrf: "new" });
  await login;
  const request = pending.splice(0, 1)[0];
  request.resolve({
    ok: true,
    status: 200,
    json: () => {
      throw Error("old body must not be parsed");
    },
  });
  await rejected;
  assert.equal(storage.currentUser().id, "new");
  assert.equal(pending.length, 0);
});
