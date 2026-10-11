import test from "node:test";
import assert from "node:assert/strict";
import { InvalidCredentialsError } from "ldapts";
import {
  ActiveDirectory,
  activeDirectoryConfig,
  createActiveDirectory,
  disabledDirectory,
  escapeLdapValue,
} from "../backend/active-directory.mjs";

const config = {
  url: "ldaps://directory.example.test:636",
  baseDN: "OU=Employees,DC=example,DC=test",
  bindDN: "CN=ReadOnly,DC=example,DC=test",
  bindPassword: "Synthetic-service-only-123!",
  groupDN: "",
};
const guid = "0123456789abcdef0123456789abcdef";
const entry = (patch = {}) => ({
  dn: "CN=Employee,OU=Employees,DC=example,DC=test",
  objectGUID: Buffer.from(guid, "hex"),
  sAMAccountName: "employee",
  displayName: "Synthetic Employee",
  mail: "employee@example.test",
  userAccountControl: "512",
  "msDS-User-Account-Control-Computed": "0",
  accountExpires: "0",
  ...patch,
});
function fixture({
  entries = [entry()],
  references = [],
  groupDN = "",
  now = () => Date.now(),
} = {}) {
  const calls = [];
  const state = {
    entries,
    references,
    error: null,
    credentialError: null,
    gate: null,
  };
  const directory = new ActiveDirectory(
    { ...config, groupDN },
    () => ({
      async bind(dn, password) {
        calls.push({ method: "bind", dn, password });
        if (state.error) throw state.error;
        if (dn !== config.bindDN && state.credentialError)
          throw state.credentialError;
      },
      async search(base, options) {
        calls.push({ method: "search", base, options });
        if (state.gate) await state.gate;
        return {
          searchEntries: state.entries,
          searchReferences: state.references,
        };
      },
      async *searchPaginated(base, options) {
        calls.push({ method: "page", base, options });
        yield {
          searchEntries: state.entries,
          searchReferences: state.references,
        };
        calls.push({ method: "unexpected-next-page" });
        throw Error("The entire directory must not be downloaded");
      },
      async unbind() {
        calls.push({ method: "unbind" });
      },
    }),
    now,
  );
  return { directory, calls, state };
}

test("AD configuration is disabled by default and refuses insecure/malformed endpoints before connecting", async () => {
  assert.equal(activeDirectoryConfig(), null);
  assert.equal(
    await createActiveDirectory({ AD_ENABLED: "false" }),
    disabledDirectory,
  );
  await assert.rejects(disabledDirectory.getUser(guid), { status: 503 });
  const env = {
    AD_ENABLED: "true",
    AD_LDAP_URL: config.url,
    AD_BASE_DN: config.baseDN,
    AD_BIND_DN: config.bindDN,
    AD_BIND_PASSWORD: config.bindPassword,
  };
  assert.equal(activeDirectoryConfig(env).url, config.url);
  for (const value of [
    "ldap://directory.example.test",
    "https://directory.example.test",
    "ldaps://user:secret@directory.example.test",
    "ldaps://directory.example.test/OU=Users",
    "ldaps://directory.example.test?q=secret",
    "not-an-address",
  ])
    assert.throws(() => activeDirectoryConfig({ ...env, AD_LDAP_URL: value }));
  for (const key of ["AD_BASE_DN", "AD_BIND_DN", "AD_BIND_PASSWORD"])
    assert.throws(
      () => activeDirectoryConfig({ ...env, [key]: "" }),
      new RegExp(key),
    );
  assert.throws(
    () => activeDirectoryConfig({ AD_ENABLED: "yes" }),
    /AD_ENABLED/,
  );
  // Constructor only: no LDAP socket is opened until an operation is requested.
  assert.equal((await createActiveDirectory(env)).configured, true);
});

test("directory search escapes LDAP filter injection, scopes by OU/group, exposes only approved profile attributes and stops at 50", async () => {
  const f = fixture({
    entries: Array.from({ length: 51 }, () => entry()),
    groupDN: "CN=Allowed*(Group),DC=example,DC=test",
  });
  const query = "*)(|(objectClass=*))\0İ";
  const result = await f.directory.listUsers(query);
  assert.equal(result.users.length, 50);
  assert.equal(result.hasMore, true);
  assert.deepEqual(Object.keys(result.users[0]).sort(), [
    "email",
    "id",
    "name",
    "username",
  ]);
  const search = f.calls.find((c) => c.method === "page");
  assert.equal(search.base, config.baseDN);
  assert.equal(search.options.paged.pageSize, 51);
  assert.equal(search.options.timeLimit, 5);
  assert(
    search.options.filter.includes(
      "memberOf:1.2.840.113556.1.4.1941:=" +
        escapeLdapValue("CN=Allowed*(Group),DC=example,DC=test"),
    ),
  );
  assert(
    search.options.filter.includes(
      "sAMAccountName=*" + escapeLdapValue(query) + "*",
    ),
  );
  assert(!search.options.filter.includes(query));
  assert(!search.options.attributes.some((a) => /pwd|password/i.test(a)));
  assert.equal(
    f.calls.filter((c) => c.method === "unexpected-next-page").length,
    0,
  );
  assert.equal(f.calls.filter((c) => c.method === "unbind").length, 1);
  assert.equal(escapeLdapValue("*()\\\0"), "\\2a\\28\\29\\5c\\00");
});

test("stable GUID lookup rejects invalid, ambiguous, referred, disabled, locked and expired profiles", async () => {
  const f = fixture({ now: () => Date.UTC(2026, 9, 11) });
  assert.equal(await f.directory.getUser("not-a-guid"), null);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.directory.getUser(guid)).id, guid);
  assert(
    f.calls
      .find((c) => c.method === "search")
      .options.filter.includes(
        "(objectGUID=\\01\\23\\45\\67\\89\\ab\\cd\\ef\\01\\23\\45\\67\\89\\ab\\cd\\ef)",
      ),
  );
  for (const patch of [
    { objectGUID: Buffer.from("short") },
    { objectGUID: guid },
    { userAccountControl: "514" },
    { "msDS-User-Account-Control-Computed": "16" },
    { "msDS-User-Account-Control-Computed": "8388608" },
    { accountExpires: "1" },
    { accountExpires: "malformed" },
    { displayName: "bad\0name" },
    { mail: "not-an-email" },
    { dn: "" },
  ]) {
    f.state.entries = [entry(patch)];
    assert.equal(await f.directory.getUser(guid), null);
  }
  f.state.entries = [entry({ accountExpires: "9223372036854775807" })];
  assert.equal((await f.directory.getUser(guid)).username, "employee");
  f.state.entries = [entry(), entry()];
  assert.equal(await f.directory.findByLogin("employee"), null);
  f.state.entries = [entry()];
  f.state.references = ["ldaps://other.example.test"];
  assert.equal(await f.directory.findByLogin("employee"), null);
  await assert.rejects(f.directory.listUsers(), { status: 503 });
});

test("AD passwords are verified by user bind; empty passwords never bind and LDAP diagnostics are sanitized", async () => {
  const f = fixture();
  for (const password of ["", null, "x".repeat(257)])
    assert.equal(await f.directory.verifyCredentials(guid, password), false);
  assert.equal(f.calls.length, 0);
  assert.equal(
    await f.directory.verifyCredentials(guid, "Synthetic-password-only"),
    true,
  );
  assert(
    f.calls.some(
      (c) =>
        c.method === "bind" &&
        c.dn === entry().dn &&
        c.password === "Synthetic-password-only",
    ),
  );
  f.state.credentialError = new InvalidCredentialsError("sensitive-diagnostic");
  assert.equal(await f.directory.verifyCredentials(guid, "wrong"), false);
  f.state.credentialError = Error("sensitive-connection-details");
  await assert.rejects(
    f.directory.verifyCredentials(guid, "wrong"),
    (e) => e.status === 503 && !e.message.includes("sensitive"),
  );
  f.state.error = new InvalidCredentialsError("sensitive-service-credentials");
  await assert.rejects(
    f.directory.getUser(guid),
    (e) => e.status === 503 && !e.message.includes("sensitive"),
  );
  assert.equal(
    f.calls.filter((c) => c.method === "bind" && c.dn === config.bindDN).length,
    f.calls.filter((c) => c.method === "unbind").length,
  );
});

test("session activity checks deduplicate requests, expire within 60 seconds and fail closed on outages", async () => {
  let now = 0;
  const f = fixture({ now: () => now });
  await Promise.all(
    Array.from({ length: 8 }, () => f.directory.ensureActive(guid)),
  );
  assert.equal(f.calls.filter((c) => c.method === "search").length, 1);
  now = 59999;
  await f.directory.ensureActive(guid);
  assert.equal(f.calls.filter((c) => c.method === "search").length, 1);
  now = 60000;
  f.state.error = Error("Synthetic LDAP outage");
  await assert.rejects(f.directory.ensureActive(guid), { status: 503 });
  await assert.rejects(f.directory.ensureActive(guid), { status: 503 });
  f.state.error = null;
  f.state.entries = [];
  await assert.rejects(f.directory.ensureActive(guid), { status: 401 });
  f.state.entries = [entry()];
  await f.directory.ensureActive(guid);
});

test("LDAP work is bounded to four concurrent connections and releases capacity after completion", async () => {
  const f = fixture();
  let release;
  f.state.gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = Array.from({ length: 4 }, () => f.directory.getUser(guid));
  await assert.rejects(f.directory.getUser(guid), { status: 503 });
  release();
  await Promise.all(pending);
  assert.equal((await f.directory.getUser(guid)).id, guid);
});

test("schema 32 preserves schema 31 credentials, roles and employee links and enforces unique AD identities", async () => {
  const { default: initSqlJs } = await import("sql.js");
  const { migrationCatalog, migrationSql } =
    await import("../backend/migration-catalog.mjs");
  const SQL = await initSqlJs(),
    db = new SQL.Database();
  try {
    for (const m of migrationCatalog.filter((m) => m.sql && m.version < 32))
      db.exec(await migrationSql("sqljs", m.version));
    db.exec(`INSERT INTO kp_resources(id,name,note) VALUES('employee','Synthetic','');
      INSERT INTO kp_users(id,username,name,role,resource_id,active,password_salt,password_hash,revision,version)
      VALUES('old','legacy.manager','Legacy Manager','manager','employee',1,'synthetic-salt','synthetic-hash',3,5);`);
    const before = db.exec("SELECT * FROM kp_users")[0];
    db.exec(await migrationSql("sqljs", 32));
    const after = db.exec("SELECT * FROM kp_users")[0];
    assert.deepEqual(
      after.columns.slice(0, before.columns.length),
      before.columns,
    );
    assert.deepEqual(
      after.values[0].slice(0, before.columns.length),
      before.values[0],
    );
    assert.deepEqual(after.values[0].slice(before.columns.length), [
      null,
      "",
      "local",
    ]);
    assert.throws(
      () =>
        db.exec(
          "UPDATE kp_users SET directory_id='" + guid + "' WHERE id='old'",
        ),
      /CHECK/,
    );
    assert.throws(
      () => db.exec("UPDATE kp_users SET auth_source='ldap' WHERE id='old'"),
      /CHECK/,
    );
    db.exec(
      "UPDATE kp_users SET directory_id='" +
        guid +
        "',auth_source='ldap' WHERE id='old'",
    );
    assert.throws(
      () =>
        db.exec(`INSERT INTO kp_users(id,username,name,role,active,password_salt,password_hash,revision,version,directory_id,auth_source)
      VALUES('other','other','Other','normal',1,'salt','hash',1,1,'${guid}','ldap')`),
      /UNIQUE/,
    );
    assert.equal(db.exec("SELECT COUNT(*) FROM kp_users")[0].values[0][0], 1);
  } finally {
    db.close();
  }
});
