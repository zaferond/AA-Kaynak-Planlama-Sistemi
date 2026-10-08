import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { Store } from "../backend/store.mjs";
import { schemaVersion } from "../backend/migration-catalog.mjs";
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
        const sourceHashes = {};
        const sourceFiles = [
          "backend/store.mjs",
          "backend/identity-repository.mjs",
          "backend/planning-reader.mjs",
          "backend/planning-writer.mjs",
          "backend/schema-migrations.mjs",
          "backend/migration-catalog.mjs",
          "backend/adapters/mssql.mjs",
          "backend/rate-limits.mjs",
          "tests/rate-limit-suite.mjs",
          "tests/login-test-fixture.mjs",
          "backend/read-records.mjs",
          "backend/operations.mjs",
          "tests/mssql-native-suite.mjs",
          "scripts/mssql-test-environment.mjs",
          "scripts/run-mssql-tests.mjs",
          "scripts/benchmark-fixture.mjs",
          "tests/mssql.integration.mjs",
          "tests/integration-suite.mjs",
          "tests/concurrency-suite.mjs",
          "shared/server-domain.ts",
          "shared/risk-system-seed.ts",
          "shared/risk-system-policy.ts",
        ];
        for (const name of (
          await fs.readdir(new URL("../backend/migrations/", import.meta.url))
        )
          .filter((name) => /^\d{3}_mssql\.sql$/.test(name))
          .sort())
          sourceFiles.push("backend/migrations/" + name);
        for (const name of sourceFiles)
          sourceHashes[name] = createHash("sha256")
            .update(await fs.readFile(new URL("../" + name, import.meta.url)))
            .digest("hex");
        return {
          checkedAt: new Date().toISOString(),
          node: process.version,
          schema: schemaVersion,
          server,
          load,
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
