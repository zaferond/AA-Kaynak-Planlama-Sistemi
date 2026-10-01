import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { applyChanges } from "../backend/operations.mjs";
import { auditEntries } from "../backend/audit.mjs";

test("audit events identify changed fields without storing credentials or private absence labels", () => {
  const base = {
    teams: [],
    projects: [],
    resources: [],
    risks: [],
    allocations: {},
    actualAllocations: {},
    leaders: [],
    personCalendar: {},
  };
  const user = {
    _id: "u",
    username: "user",
    name: "User",
    role: "normal",
    resourceId: "",
    leaders: [],
    active: true,
    password: { salt: "SECRET_SALT", hash: "SECRET_HASH" },
  };
  const events = auditEntries(
    base,
    {
      ...base,
      personCalendar: {
        "r|2026-09-01|leave": {
          type: "leave",
          hours: 2,
          label: "PRIVATE_LABEL",
        },
      },
    },
    { _id: "admin", name: "Admin" },
    { beforeUsers: [user], afterUsers: [{ ...user, role: "manager" }] },
  );
  assert.equal(events.length, 2);
  const serialized = JSON.stringify(events);
  for (const secret of ["SECRET_SALT", "SECRET_HASH", "PRIVATE_LABEL"])
    assert(!serialized.includes(secret));
  assert.deepEqual(
    JSON.parse(events.find((event) => event.kind === "user").changes),
    [{ path: ["role"], before: "normal", after: "manager" }],
  );
});

test("audit history commits atomically, survives restart and is available only to admins", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-audit-"));
  const store = new Store({
    env: { DB_PROVIDER: "sqljs", SQLJS_FILE: path.join(dir, "plan.sqlite") },
  });
  try {
    await store.connect();
    const password = await hashPassword("Audit-test-password-284!");
    for (const [id, role] of [
      ["root-admin", "admin"],
      ["reader", "normal"],
    ])
      await store.bootstrapUser({
        _id: id,
        username: id,
        name: id,
        role,
        leaders: [],
        active: true,
        password,
        revision: 1,
        version: 1,
      });
    const admin = await store.findUser({ id: "root-admin" }),
      reader = await store.findUser({ id: "reader" });
    const project = {
      id: "audit-project",
      name: "Önceki ad",
      start: "2026-01",
      end: "2026-12",
      phases: {},
    };
    await store.mutate(admin, (d) =>
      applyChanges(d, admin, [
        { kind: "project", id: project.id, value: project, revision: 0 },
      ]),
    );
    await store.mutate(admin, (d) =>
      applyChanges(d, admin, [
        {
          kind: "project",
          id: project.id,
          value: { ...project, name: "Yeni ad" },
          revision: 1,
        },
      ]),
    );
    const history = await store.auditLog(admin, { limit: 1 });
    assert.equal(history.total, 2);
    assert.equal(history.entries.length, 1);
    assert.equal(
      (await store.auditLog(admin, { offset: 1, limit: 1 })).entries.length,
      1,
    );
    const edit = (await store.auditLog(admin)).entries.find(
      (entry) => entry.action === "update",
    );
    assert.deepEqual(edit.changes, [
      { path: ["name"], before: "Önceki ad", after: "Yeni ad" },
    ]);
    assert.equal(edit.actor_id, "root-admin");
    await assert.rejects(
      () => store.auditLog(reader),
      (error) => error.status === 403,
    );
    const before = await store.read();
    await assert.rejects(
      () =>
        store.mutate(admin, (d, u, c) => {
          applyChanges(d, u, [
            {
              kind: "project",
              id: project.id,
              value: { ...project, name: "Must roll back" },
              revision: 2,
            },
          ]);
          const upsert = c.upsert;
          c.upsert = async (name, rows) => {
            if (name === "audit_events") throw Error("Audit unavailable");
            return upsert(name, rows);
          };
        }),
      /Audit unavailable/,
    );
    assert.deepEqual(await store.read(), before);
    assert.equal((await store.auditLog(admin)).total, 2);
    await store.close();
    await store.connect();
    assert.equal((await store.auditLog(admin)).total, 2);
    await store.mutate(admin, (d) =>
      applyChanges(d, admin, [
        { kind: "project", id: project.id, operation: "delete", revision: 2 },
      ]),
    );
    assert.equal(
      (await store.auditLog(admin)).entries.filter(
        (entry) => entry.action === "delete",
      ).length,
      1,
    );
  } finally {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
