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
