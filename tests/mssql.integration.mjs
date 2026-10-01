import test from "node:test";
import { Store } from "../backend/store.mjs";
import { MssqlAdapter, sqlConfig } from "../backend/adapters/mssql.mjs";
import { tables, table } from "../backend/tables.mjs";
import { concurrencySuite } from "./concurrency-suite.mjs";
import { integrationSuite } from "./integration-suite.mjs";
test("MSSQL: native driver, schema, CRUD, FK, concurrent updates and rollback", async (t) => {
  if (
    !process.env.TEST_DB_DATABASE ||
    !process.env.TEST_DB_DATABASE.endsWith("_test")
  )
    throw Error(
      "IT tarafından ayrılmış boş test veritabanını TEST_DB_DATABASE=..._test ile belirtin.",
    );
  const env = {
    ...process.env,
    DB_PROVIDER: "mssql",
    DB_DATABASE: process.env.TEST_DB_DATABASE,
    DB_AUTO_MIGRATE: "true",
    NODE_ENV: "test",
  };
  const inspect = new MssqlAdapter(sqlConfig(env));
  await inspect.open();
  const occupied = (
    await inspect.query("SELECT name FROM sys.tables WHERE name LIKE 'kp[_]%'")
  ).rows.length;
  await inspect.close();
  if (occupied)
    throw Error(
      "Test veritabanında kp_ tabloları var. Güvenlik için test çalıştırılmadı. Boş bir test veritabanı seçin.",
    );
  const store = new Store({ env });
  try {
    await integrationSuite(store);
    await concurrencySuite(store, t);
  } finally {
    try {
      if (store.db.pool.connected)
        await store.transaction(async (c) => {
          for (const t of [...Object.keys(tables)].reverse())
            await c.query(
              `IF OBJECT_ID(N'kp_${t}',N'U') IS NOT NULL DROP TABLE ${table(t)}`,
            );
          await c.query(
            "IF OBJECT_ID(N'kp_schema_migrations',N'U') IS NOT NULL DROP TABLE kp_schema_migrations",
          );
        });
    } finally {
      await store.close();
    }
  }
});
