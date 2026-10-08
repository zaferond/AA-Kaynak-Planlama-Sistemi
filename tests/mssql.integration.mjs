import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deploymentSources } from "../scripts/deployment-manifest.mjs";
import { Store } from "../backend/store.mjs";
import { schemaVersion } from "../backend/migration-catalog.mjs";
import {
  nativeContentionProfile,
  nativeProfileOptions,
} from "../scripts/native-contention-profile.mjs";
import { concurrencySuite } from "./concurrency-suite.mjs";
import { integrationSuite } from "./integration-suite.mjs";
import { sharedRateLimitSuite } from "./rate-limit-suite.mjs";
import {
  nativePoolSuite,
  nativeLoadProfile,
  nativeUpgradeSuite,
  checkedNativeContext,
} from "./mssql-native-suite.mjs";
import {
  mssqlTestEnvironment,
  withMssqlTestDatabase,
  cleanupTestTables,
} from "../scripts/mssql-test-environment.mjs";

test(
  "MSSQL: native schema, HTTP, independent pools, rollback, scope and synthetic load",
  { timeout: 900000 },
  async (t) => {
    const env = mssqlTestEnvironment();
    const checked = checkedNativeContext(t);
    const size = Number(process.env.TEST_DB_LOAD_SIZE || 1000),
      samples = Number(process.env.TEST_DB_LOAD_SAMPLES || 3);
    assert(Number.isInteger(size) && size >= 24 && size <= 100000);
    assert(Number.isInteger(samples) && samples >= 1 && samples <= 10);
    const report = await withMssqlTestDatabase(env, async (server) => {
      const stores = Array.from({ length: 2 }, () => new Store({ env }));
      try {
        await checked.test(
          `native legacy v2 upgrade to schema ${schemaVersion} preserves data and runs once`,
          () => nativeUpgradeSuite(stores[0]),
        );
        await cleanupTestTables(stores[0].db);
        await checked.test(
          "native HTTP CRUD, permissions, import, restore and SQL constraints",
          () => integrationSuite(stores[0]),
        );
        await concurrencySuite(stores[0], checked);
        // Each profile starts with a fresh schema and no preceding fixture/audit.
        await cleanupTestTables(stores[0].db);
        await stores[0].connect();
        await stores[1].connect();
        await checked.test(
          "shared login budgets across independent native pools and HTTP services",
          (sub) => sharedRateLimitSuite(stores, sub),
        );
        await nativePoolSuite(stores, checked);
        await cleanupTestTables(stores[0].db);
        await stores[0].connect();
        const load = await nativeLoadProfile(stores, checked, {
          size,
          samples,
        });
        let contention;
        if (process.env.TEST_DB_CONTENTION === "true") {
          const options = nativeProfileOptions({
            requests: process.env.TEST_DB_PROFILE_REQUESTS,
            actuals: process.env.TEST_DB_PROFILE_ACTUALS,
            concurrency: process.env.TEST_DB_PROFILE_CONCURRENCY,
          });
          assert(size >= options.requests);
          await cleanupTestTables(stores[0].db);
          await stores[0].connect();
          await checked.test(
            "native bounded contention profile preserves scope, revisions, commit snapshots and audit",
            async () => {
              contention = await nativeContentionProfile(stores, {
                size,
                ...options,
              });
            },
          );
        }
        const before = await stores[0].transaction(
          (c) => stores[0].read(c),
          true,
        );
        await stores[1].close();
        await stores[1].connect();
        assert.deepEqual(
          await stores[1].transaction((c) => stores[1].read(c), true),
          before,
        );
        // Identify the full application/build inputs and test sources. A hash
        // proves which bytes were present, not that every feature was tested.
        const sourceHashes = await deploymentSources(
          fileURLToPath(new URL("../", import.meta.url)),
        );
        const sourceFiles = [
          ...(await fs.readdir(new URL("./", import.meta.url)))
            .filter((name) => name.endsWith(".mjs"))
            .map((name) => "tests/" + name),
          ".github/workflows/mssql-native.yml",
          ".github/workflows/quality.yml",
        ];
        for (const name of sourceFiles)
          sourceHashes[name] = createHash("sha256")
            .update(await fs.readFile(new URL("../" + name, import.meta.url)))
            .digest("hex");
        return {
          checkedAt: new Date().toISOString(),
          checkedCommit: /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || "")
            ? process.env.GITHUB_SHA
            : null,
          sourceHashScope:
            "Application/build inputs and test sources; identity is not feature coverage.",
          node: process.version,
          schema: schemaVersion,
          server,
          load,
          ...(contention ? { contention } : {}),
          sourceHashes,
        };
      } finally {
        const closed = await Promise.allSettled(
          stores.map((store) => store.close()),
        );
        const errors = closed
          .filter((r) => r.status === "rejected")
          .map((r) => r.reason);
        if (errors.length)
          throw new AggregateError(errors, "Test pools did not close.");
      }
    });
    // No success report until database cleanup and lease release have finished.
    if (process.env.TEST_DB_REPORT)
      await fs.writeFile(
        process.env.TEST_DB_REPORT,
        JSON.stringify({ ...report, cleanupVerified: true }, null, 2) + "\n",
        { mode: 0o600, flag: "wx" },
      );
    t.diagnostic(
      "Native MSSQL assertions and cleanup completed; no real application data or credentials in the report.",
    );
  },
);
