import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { isPlanningCommand } from "../backend/operations.mjs";

const round = (value) => Math.round(value * 1000) / 1000;
export function latencySummary(values) {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0))
    throw Error("Profile requires finite nonnegative observations.");
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.ceil(sorted.length * p) - 1];
  return {
    count: values.length,
    median: round(at(0.5)),
    sampleP95: round(at(0.95)),
    sampleP99: round(at(0.99)),
    max: round(sorted.at(-1)),
  };
}

// A bounded worker pool does not retain completed full snapshots. Queue time is
// measured separately from the Store call; there is no unlimited Promise.all.
export async function profileWorkers(
  count,
  concurrency,
  task,
  clock = () => performance.now(),
) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 200 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 20
  )
    throw Error("Invalid profile worker limits.");
  const queuedAt = clock();
  let next = 0;
  const results = [];
  const workers = Array.from(
    { length: Math.min(count, concurrency) },
    async () => {
      while (next < count) {
        const index = next++;
        const queueMs = clock() - queuedAt;
        results[index] = await task(index, queueMs);
      }
    },
  );
  // Drain every owned worker even on an assertion failure before restoring hooks
  // or closing the disposable database.
  const finished = await Promise.allSettled(workers);
  const errors = finished
    .filter((r) => r.status === "rejected")
    .map((r) => r.reason);
  if (errors.length)
    throw new AggregateError(errors, "Synthetic profile failed.");
  return results;
}

export function memorySampler({
  sample = () => process.memoryUsage(),
  intervalMs = 20,
} = {}) {
  const before = sample();
  const peak = { ...before };
  function capture() {
    const value = sample();
    for (const key of Object.keys(peak))
      peak[key] = Math.max(peak[key], value[key]);
    return value;
  }
  const timer = setInterval(capture, intervalMs);
  timer.unref();
  return {
    capture,
    stop() {
      clearInterval(timer);
      return { before, after: capture(), sampledPeak: peak };
    },
  };
}

const lockSqlPrefix = "DECLARE @r int; EXEC @r=sys.sp_getapplock";
// Only a disposable native Store may be instrumented. The integration runner
// additionally owns a verified-empty database lease for the entire profile.
export function assertNativeProfileStores(stores) {
  if (
    !stores.length ||
    new Set(stores).size !== stores.length ||
    stores.some(
      (s) =>
        s.provider !== "mssql" ||
        s.env.NODE_ENV !== "test" ||
        !/_test$/i.test(s.env.DB_DATABASE || ""),
    )
  )
    throw Error("Profiling requires a native synthetic test Store.");
  for (const store of stores) {
    for (const name of [
      "read",
      "persist",
      "projectView",
      "copySnapshot",
      "mutate",
    ])
      if (typeof store[name] !== "function")
        throw Error("Missing profile method.");
    for (const name of ["transaction", "request"])
      if (typeof store.db?.[name] !== "function")
        throw Error("Missing profile method.");
  }
}

export function transactionProbe(
  stores,
  { captureMemory = () => {}, clock = () => performance.now() } = {},
) {
  assertNativeProfileStores(stores);
  const context = new AsyncLocalStorage();
  const restores = [];
  function wrap(target, name, factory) {
    const original = target[name];
    const own = Object.getOwnPropertyDescriptor(target, name);
    if (typeof original !== "function") throw Error("Missing profile method.");
    target[name] = factory(original);
    restores.push(() =>
      own ? Object.defineProperty(target, name, own) : delete target[name],
    );
  }
  for (const store of stores) {
    for (const name of ["read", "persist", "projectView"])
      wrap(
        store,
        name,
        (original) =>
          async function (...args) {
            const observation = context.getStore();
            const start = clock();
            if (
              observation &&
              name === "persist" &&
              observation.copyEnd !== undefined
            ) {
              observation.commandAndValidationAndDiffPrepMs +=
                start - observation.copyEnd;
              delete observation.copyEnd;
            }
            if (
              observation &&
              name === "persist" &&
              observation.commandEnd !== undefined
            ) {
              observation.validationAndDiffPrepMs +=
                start - observation.commandEnd;
              delete observation.commandEnd;
            }
            try {
              return await original.apply(this, args);
            } finally {
              if (observation) {
                observation[name + "Ms"] += clock() - start;
                observation[name + "Calls"]++;
                captureMemory();
              }
            }
          },
      );
    wrap(
      store,
      "copySnapshot",
      (original) =>
        function (...args) {
          const start = clock(),
            observation = context.getStore();
          try {
            return original.apply(this, args);
          } finally {
            if (observation) {
              observation.copySnapshotMs += clock() - start;
              observation.copySnapshotCalls++;
              observation[
                args[1]?.planningOnly
                  ? "planningDraftCopies"
                  : "fullSnapshotCopies"
              ]++;
              observation.copyEnd = clock();
              captureMemory();
            }
          }
        },
    );
    wrap(
      store,
      "mutate",
      (original) =>
        async function (user, command, options) {
          // Preserve the owned callback identity: replacing it would silently
          // measure the full-copy fallback instead of the production path.
          if (isPlanningCommand(command)) {
            const observation = context.getStore();
            if (observation) observation.commandTimingMode = "combined";
            return original.call(this, user, command, options);
          }
          return original.call(
            this,
            user,
            async (...args) => {
              const observation = context.getStore(),
                start = clock();
              try {
                return await command(...args);
              } finally {
                if (observation) {
                  observation.commandMs += clock() - start;
                  observation.commandEnd = clock();
                }
              }
            },
            options,
          );
        },
    );
    if (typeof store.projectPlanningDelta === "function")
      wrap(
        store,
        "projectPlanningDelta",
        (original) =>
          function (...args) {
            const start = clock(),
              observation = context.getStore();
            try {
              return original.apply(this, args);
            } finally {
              if (observation) {
                observation.planningDeltaProjectionMs += clock() - start;
                observation.planningDeltaProjectionCalls++;
                captureMemory();
              }
            }
          },
      );
    wrap(
      store.db,
      "transaction",
      (original) =>
        async function (fn, readOnly) {
          const observation = context.getStore(),
            start = clock();
          let bodyEnd;
          try {
            return await original.call(
              this,
              async (...args) => {
                if (observation)
                  observation.transactionEntryMs += clock() - start;
                try {
                  return await fn(...args);
                } finally {
                  bodyEnd = clock();
                }
              },
              readOnly,
            );
          } finally {
            if (observation && bodyEnd !== undefined)
              observation.transactionTailMs += clock() - bodyEnd;
          }
        },
    );
    wrap(
      store.db,
      "request",
      (original) =>
        async function (owner, text, values) {
          const observation = context.getStore();
          if (!observation) return original.call(this, owner, text, values);
          const lock =
            text.startsWith(lockSqlPrefix) && values?.[0] === "aa_kaynak_data";
          const start = clock();
          // Server-side time isolates the sp_getapplock call from client/pool/network
          // overhead. It includes the procedure's execution cost, not only pure wait.
          const measuredSql = lock
            ? "DECLARE @profileStarted datetime2(7)=SYSUTCDATETIME(); " +
              text +
              " SELECT CONVERT(float,DATEDIFF_BIG(MICROSECOND,@profileStarted,SYSUTCDATETIME()))/1000.0 AS profileLockAcquireMs;"
            : text;
          const result = await original.call(this, owner, measuredSql, values);
          observation.sqlMs += clock() - start;
          observation.sqlCalls++;
          if (lock) {
            const serverMs = result.rows[0]?.profileLockAcquireMs;
            if (
              result.rows.length !== 1 ||
              !Number.isFinite(serverMs) ||
              serverMs < 0
            )
              throw Error("Missing native lock timing result.");
            observation.lockAcquireServerMs += serverMs;
            observation.lockAcquireRoundtripMs += clock() - start;
            observation.lockCalls++;
            return { ...result, rows: [], rowCount: 0 };
          }
          if (/^\s*(SELECT|WITH)\b/i.test(text)) {
            const table = /\bkp_([a-z_]+)/i.exec(text)?.[1] || "other";
            observation.sqlRows[table] =
              (observation.sqlRows[table] || 0) + result.rows.length;
          }
          return result;
        },
    );
  }
  let active = 0,
    restored = false;
  return {
    async measure(kind, task) {
      if (restored) throw Error("Profile already restored.");
      const observation = {
        kind,
        elapsedMs: 0,
        transactionEntryMs: 0,
        transactionTailMs: 0,
        lockAcquireServerMs: 0,
        lockAcquireRoundtripMs: 0,
        lockCalls: 0,
        readMs: 0,
        readCalls: 0,
        copySnapshotMs: 0,
        copySnapshotCalls: 0,
        commandMs: 0,
        validationAndDiffPrepMs: 0,
        commandAndValidationAndDiffPrepMs: 0,
        planningDraftCopies: 0,
        fullSnapshotCopies: 0,
        planningDeltaProjectionMs: 0,
        planningDeltaProjectionCalls: 0,
        commandTimingMode: "separate",
        persistMs: 0,
        persistCalls: 0,
        projectViewMs: 0,
        projectViewCalls: 0,
        sqlMs: 0,
        sqlCalls: 0,
        sqlRows: {},
      };
      active++;
      try {
        return await context.run(observation, async () => {
          const start = clock();
          try {
            return { value: await task(), observation };
          } finally {
            observation.elapsedMs = clock() - start;
            delete observation.commandEnd;
            delete observation.copyEnd;
            captureMemory();
          }
        });
      } finally {
        active--;
      }
    },
    restore() {
      if (active) throw Error("Cannot restore an active profile.");
      if (restored) return;
      restores.reverse().forEach((restore) => restore());
      restored = true;
      context.disable();
    },
  };
}
