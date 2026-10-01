import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { Store } from "../backend/store.mjs";
import { applyChanges, stageChanges } from "../backend/operations.mjs";
import { validate } from "../shared/server-domain.ts";
import { hashPassword } from "../backend/auth.mjs";

// Never load .env or accept a database path/provider. Only generated temporary SQL.js data.
const options = new Map(
  process.argv.slice(2).map((arg) => {
    const match =
      /^--(sizes|samples|calendar-days|audit-events|response|validation|output)=(.+)$/.exec(
        arg,
      );
    if (!match)
      throw Error(
        "Use --sizes=1000,10000,50000 --samples=5 --calendar-days=1000 --audit-events=0 --response=separate|planning --validation=double|single --output=/tmp/result.json",
      );
    return [match[1], match[2]];
  }),
);
const integer = (value, min, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max)
    throw Error(`Expected integer ${min}–${max}.`);
  return number;
};
const sizes = (options.get("sizes") || "1000,10000,50000")
  .split(",")
  .map((value) => integer(value, 1, 100000));
if (sizes.length > 5) throw Error("At most five data sizes per run.");
const samples = integer(options.get("samples") || "5", 1, 20);
const calendarDays = integer(options.get("calendar-days") || "1000", 0, 100000);
const auditEvents = integer(options.get("audit-events") || "0", 0, 100000);
const responseMode = options.get("response") || "separate";
if (!["separate", "planning"].includes(responseMode))
  throw Error("Expected --response=separate or --response=planning.");
const validationMode = options.get("validation") || "single";
if (!["single", "double"].includes(validationMode))
  throw Error("Expected --validation=single or --validation=double.");
const apply = validationMode === "single" ? stageChanges : applyChanges;
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[
    Math.max(0, Math.ceil(values.length * p) - 1)
  ];
const round = (value) => Math.round(value * 100) / 100;

async function seed(store, size) {
  const { data } = await store.read();
  const teams = data.teams.filter((team) => team.lead);
  const months = Array.from(
    { length: 48 },
    (_, i) =>
      `${2026 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
  );
  const projectCount = Math.ceil(size / (teams.length * months.length));
  data.projects = Array.from({ length: projectCount }, (_, i) => ({
    id: "bench-p" + i,
    name: "Synthetic project " + i,
    start: "2026-01",
    end: "2029-12",
    phases: {},
  }));
  data.resources = Array.from({ length: 200 }, (_, i) => {
    const team = teams[i % teams.length];
    return {
      id: "bench-r" + i,
      name: "Synthetic resource " + i,
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
    };
  });
  for (let i = 0; i < size; i++) {
    const key =
      teams[i % teams.length].id +
      "|" +
      data.projects[Math.floor(i / (teams.length * months.length))].id +
      "|" +
      months[Math.floor(i / teams.length) % months.length];
    data.allocations[key] = 0.25;
    data.revisions["allocation:" + key] = 1;
  }
  for (let i = 0; i < calendarDays; i++) {
    const date = new Date(
      Date.UTC(2026, 0, 1 + Math.floor(i / data.resources.length)),
    )
      .toISOString()
      .slice(0, 10);
    data.personCalendar[
      data.resources[i % data.resources.length].id + "|" + date + "|leave"
    ] = { type: "leave", hours: 0.5, label: "" };
  }
  const valid = validate(data);
  await store.transaction(async (c) => {
    const before = (await store.read(c)).data;
    await store.persist(before, valid, c);
    await c.query("UPDATE kp_settings SET person_calendar=@p0 WHERE id=1", [
      JSON.stringify(valid.personCalendar),
    ]);
    await c.upsert(
      "audit_events",
      Array.from({ length: auditEvents }, () => ({
        id: randomUUID(),
        occurred_at: "2026-01-01T00:00:00.000Z",
        actor_id: "bench-admin",
        actor_name: "Synthetic admin",
        kind: "allocation",
        record_id: "synthetic",
        record_name: "Synthetic history",
        action: "update",
        changes: '[{"path":["amount"],"before":0,"after":0.25}]',
      })),
    );
  });
  return Object.keys(data.allocations)[0];
}

function instrument(store) {
  let current;
  const originals = [];
  const wrap = (target, name, replacement) => {
    const original = target[name];
    target[name] = replacement(original);
    originals.push(() => {
      target[name] = original;
    });
  };
  for (const method of ["read", "persist"])
    wrap(
      store,
      method,
      (original) =>
        async function (...args) {
          const start = performance.now();
          try {
            return await original.apply(this, args);
          } finally {
            if (current) {
              current[method + "Ms"] += performance.now() - start;
              current[method + "Calls"]++;
            }
          }
        },
    );
  wrap(
    globalThis,
    "structuredClone",
    (original) =>
      function (...args) {
        const start = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          if (current) {
            current.cloneMs += performance.now() - start;
            current.cloneCalls++;
          }
        }
      },
  );
  wrap(
    store.db,
    "raw",
    (original) =>
      function (sql, values) {
        const result = original.call(this, sql, values);
        if (current) {
          current.sqlStatements++;
          if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql))
            current.selectedRows += result.rows.length;
          else {
            const name = /\bkp_([a-z_]+)/i.exec(sql)?.[1] || "other";
            current.writtenRows[name] =
              (current.writtenRows[name] || 0) + result.rowCount;
            current.writeParameterBytes += Buffer.byteLength(
              JSON.stringify(values || []),
            );
          }
        }
        return result;
      },
  );
  wrap(
    store.db.db,
    "export",
    (original) =>
      function (...args) {
        const start = performance.now();
        const result = original.apply(this, args);
        if (current) {
          current.exportMs += performance.now() - start;
          current.exportCalls++;
          current.exportBytes += result.length;
        }
        return result;
      },
  );
  return {
    start() {
      current = {
        readMs: 0,
        readCalls: 0,
        persistMs: 0,
        persistCalls: 0,
        domainMs: 0,
        cloneMs: 0,
        cloneCalls: 0,
        exportMs: 0,
        exportCalls: 0,
        exportBytes: 0,
        sqlStatements: 0,
        selectedRows: 0,
        writtenRows: {},
        writeParameterBytes: 0,
      };
      return current;
    },
    stop() {
      current = undefined;
    },
    restore() {
      originals.reverse().forEach((restore) => restore());
    },
  };
}

const password = await hashPassword("Synthetic-benchmark-only-284!");
const results = [];
for (const size of sizes) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-store-benchmark-"));
  const file = path.join(dir, "synthetic.sqlite");
  const store = new Store({
    env: { NODE_ENV: "test", DB_PROVIDER: "sqljs", SQLJS_FILE: file },
  });
  let metrics;
  try {
    await store.connect();
    await store.bootstrapUser({
      _id: "bench-admin",
      username: "bench.admin",
      name: "Synthetic admin",
      role: "admin",
      leaders: [],
      active: true,
      password,
      revision: 1,
      version: 1,
    });
    const user = await store.findUser({ id: "bench-admin" });
    const key = await seed(store, size);
    let state = await store.view(user);
    // Warm up the same code paths, including SQL and file commit, outside measurements.
    await store.mutate(
      user,
      (data, active) =>
        apply(data, active, [
          {
            kind: "allocation",
            id: key,
            value: 0.5,
            revision: data.revisions["allocation:" + key],
          },
        ]),
      { returnPlanningView: responseMode === "planning" },
    );
    state = await store.view(user);
    const initialGeneration = state.generation,
      initialAudit = (await store.auditLog(user)).total;
    metrics = instrument(store);
    const observations = [];
    for (let i = 0; i < samples; i++) {
      const observation = metrics.start(),
        start = performance.now();
      const result = await store.mutate(
        user,
        (data, active) => {
          const domainStart = performance.now();
          apply(data, active, [
            {
              kind: "allocation",
              id: key,
              value: i % 2 ? 0.5 : 0.25,
              revision: state.data.revisions["allocation:" + key],
            },
          ]);
          observation.domainMs += performance.now() - domainStart;
        },
        { returnPlanningView: responseMode === "planning" },
      );
      observation.mutateMs = performance.now() - start;
      const viewStart = performance.now();
      state = responseMode === "planning" ? result : await store.view(user);
      observation.viewMs =
        responseMode === "planning" ? 0 : performance.now() - viewStart;
      observation.pipelineMs = performance.now() - start;
      metrics.stop();
      const jsonStart = performance.now(),
        json = JSON.stringify(state);
      observation.jsonMs = performance.now() - jsonStart;
      observation.responseBytes = Buffer.byteLength(json);
      observations.push(observation);
    }
    assert.equal(state.generation, initialGeneration + samples);
    assert.equal((await store.auditLog(user)).total, initialAudit + samples);
    assert.equal(state.data.revisions["allocation:" + key], 2 + samples);
    const medians = Object.fromEntries(
      [
        "pipelineMs",
        "mutateMs",
        "viewMs",
        "readMs",
        "persistMs",
        "domainMs",
        "cloneMs",
        "exportMs",
        "jsonMs",
      ].map((key) => [
        key,
        round(
          percentile(
            observations.map((item) => item[key]),
            0.5,
          ),
        ),
      ]),
    );
    const result = {
      allocations: size,
      responseMode,
      validationMode,
      resources: 200,
      calendarDays,
      initialAuditEvents: auditEvents,
      databaseBytes: (await fs.stat(file)).size,
      medians,
      p95PipelineMs: round(
        percentile(
          observations.map((item) => item.pipelineMs),
          0.95,
        ),
      ),
      observations,
    };
    results.push(result);
    console.log(
      JSON.stringify({
        allocations: size,
        responseMode,
        validationMode,
        calendarDays,
        initialAuditEvents: auditEvents,
        medians,
        readCalls: observations[0].readCalls,
        cloneCalls: observations[0].cloneCalls,
        selectedRows: observations[0].selectedRows,
        writtenRows: observations[0].writtenRows,
        writeParameterBytes: observations[0].writeParameterBytes,
      }),
    );
  } finally {
    metrics?.restore();
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
}
const report = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  provider: "sqljs",
  samples,
  responseMode,
  validationMode,
  storeSha256: createHash("sha256")
    .update(await fs.readFile(new URL("../backend/store.mjs", import.meta.url)))
    .digest("hex"),
  operationsSha256: createHash("sha256")
    .update(
      await fs.readFile(new URL("../backend/operations.mjs", import.meta.url)),
    )
    .digest("hex"),
  changeServiceSha256: createHash("sha256")
    .update(
      await fs.readFile(
        new URL("../backend/change-service.mjs", import.meta.url),
      ),
    )
    .digest("hex"),
  scope:
    "Local synthetic write + full response pipeline (separate Store.view or planning view within mutation); no HTTP/network or native MSSQL performance claim. All databases created and removed in os.tmpdir().",
  results,
};
if (options.has("output"))
  await fs.writeFile(
    path.resolve(options.get("output")),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
