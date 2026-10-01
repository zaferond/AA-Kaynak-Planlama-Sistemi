import sql from "mssql";
import { tableSpec, table, ident, validateRows } from "../tables.mjs";
export function sqlConfig(env = process.env) {
  const bool = (k, fallback) =>
    env[k] === undefined ? fallback : env[k] === "true";
  const config = {
    server: env.DB_SERVER || "localhost",
    database: env.DB_DATABASE || "AA_KaynakPlanlama",
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionTimeout: 15000,
    requestTimeout: 45000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: bool("DB_ENCRYPT", true),
      trustServerCertificate: bool("DB_TRUST_SERVER_CERTIFICATE", false),
      abortTransactionOnError: true,
    },
  };
  if (env.DB_INSTANCE) {
    config.options.instanceName = env.DB_INSTANCE;
  } else {
    config.port = Number(env.DB_PORT || 1433);
    if (
      !Number.isInteger(config.port) ||
      config.port < 1 ||
      config.port > 65535
    )
      throw Error("DB_PORT geçersiz.");
  }
  if (env.DB_AUTH === "ntlm") {
    config.authentication = {
      type: "ntlm",
      options: {
        domain: env.DB_DOMAIN,
        userName: env.DB_USER,
        password: env.DB_PASSWORD,
      },
    };
    delete config.user;
    delete config.password;
  } else if (env.DB_AUTH && env.DB_AUTH !== "sql")
    throw Error("DB_AUTH sql veya ntlm olmalıdır.");
  if (
    env.NODE_ENV === "production" &&
    (!config.options.encrypt || config.options.trustServerCertificate)
  )
    throw Error(
      "Canlı ortamda şifreleme ve sertifika doğrulaması etkin olmalıdır.",
    );
  return config;
}
export class MssqlAdapter {
  constructor(config) {
    this.pool = new sql.ConnectionPool(config);
    this.pool.on("error", (e) => console.error("MSSQL pool:", e.code));
  }
  async open() {
    await this.pool.connect();
  }
  async request(owner, text, values = []) {
    const r = new sql.Request(owner);
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      r.input(
        "p" + i,
        v instanceof Date
          ? sql.DateTime2
          : typeof v === "boolean"
            ? sql.Bit
            : typeof v === "number"
              ? Number.isInteger(v)
                ? sql.BigInt
                : sql.Float
              : sql.NVarChar(sql.MAX),
        v ?? null,
      );
    }
    const result = await r.query(text);
    return {
      rows: result.recordset || [],
      rowCount:
        result.recordset?.length ||
        result.rowsAffected.reduce((a, b) => a + b, 0),
    };
  }
  async transaction(fn, readOnly = false) {
    const tx = new sql.Transaction(this.pool);
    let aborted = false;
    tx.on("rollback", () => (aborted = true));
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    try {
      // Shared read lock / exclusive write lock, always acquired before touching application rows.
      await this.request(
        tx,
        "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'aa_kaynak_data', @LockMode=@p0, @LockOwner=N'Transaction', @LockTimeout=15000; IF @r<0 THROW 50001, 'Application lock timeout',1;",
        [readOnly ? "Shared" : "Exclusive"],
      );
      const c = {
        query: (q, v) => this.request(tx, q, v),
        batch: (q) => new sql.Request(tx).batch(q),
        upsert: (t, r) => this.upsert(tx, t, r),
        remove: (t, r) => this.remove(tx, t, r),
      };
      const out = await fn(c);
      await tx.commit();
      return out;
    } catch (e) {
      if (!aborted) await tx.rollback().catch(() => {});
      throw e;
    }
  }
  query(q, v) {
    return this.request(this.pool, q, v);
  }
  async upsert(tx, name, rows) {
    if (!rows.length) return;
    validateRows(name, rows);
    const spec = tableSpec(name),
      cols = Object.keys(spec.columns),
      others = cols.filter((c) => !spec.key.includes(c));
    const src = `OPENJSON(@p0) WITH (${cols.map((c) => `${ident(c)} ${spec.columns[c]} '$.${c}'`).join(",")})`;
    const join = spec.key
      .map(
        (c) =>
          `t.${ident(c)}=s.${ident(c)}${spec.columns[c].includes("char") ? " COLLATE Latin1_General_100_BIN2" : ""}`,
      )
      .join(" AND ");
    // No MERGE: updates/inserts run under the application transaction lock.
    const update = others.length
      ? `UPDATE t SET ${others.map((c) => `${ident(c)}=s.${ident(c)}`).join(",")} FROM ${table(name)} t JOIN ${src} s ON ${join};`
      : "";
    await this.request(
      tx,
      `${update} INSERT INTO ${table(name)} (${cols.map(ident)}) SELECT ${cols.map((c) => "s." + ident(c))} FROM ${src} s WHERE NOT EXISTS(SELECT 1 FROM ${table(name)} t WHERE ${join});`,
      [JSON.stringify(rows)],
    );
  }
  async remove(tx, name, keys) {
    if (!keys.length) return;
    const spec = tableSpec(name);
    await this.request(
      tx,
      `DELETE t FROM ${table(name)} t JOIN OPENJSON(@p0) WITH (${spec.key.map((c) => `${ident(c)} ${spec.columns[c]} '$.${c}'`).join(",")}) s ON ${spec.key.map((c) => `t.${ident(c)}=s.${ident(c)}${spec.columns[c].includes("char") ? " COLLATE Latin1_General_100_BIN2" : ""}`).join(" AND ")}`,
      [JSON.stringify(keys)],
    );
  }
  async close() {
    await this.pool.close();
  }
}
