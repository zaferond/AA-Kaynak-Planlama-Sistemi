import test from "node:test";
import assert from "node:assert/strict";
import sql from "mssql";
import { MssqlAdapter } from "../backend/adapters/mssql.mjs";
import { readRecordMap } from "../backend/read-records.mjs";

// Stub the driver's _query before use. The real Request event/promise wrapper
// runs, but no connection, network, .env or database is accessed.
const adapter = () => new MssqlAdapter({ server: "synthetic.invalid" });
const metadata = [{ name: "key" }, { name: "value" }];
const complete = (callback, count = 0) =>
  callback(null, null, {}, [count], [metadata]);
const assertReleased = (request) => {
  for (const event of ["error", "row", "recordset", "done"])
    assert.equal(request.listenerCount(event), 0, event);
};

test("native scan directly builds the map, keeps SELECT order and releases listeners", async (t) => {
  const db = adapter(),
    input = [
      ["__proto__", 0],
      ["constructor", 0.25],
      ["Türkçe 😀", null],
    ];
  let request;
  t.mock.method(sql.Request.prototype, "_query", function (text, callback) {
    request = this;
    assert.equal(text, "SELECT fixed_key,fixed_value");
    assert.equal(this.parent, db.pool);
    assert.equal(this.stream, true);
    assert.equal(this.arrayRowMode, true);
    this.emit("recordset", metadata);
    input.forEach((row) => this.emit("row", row));
    complete(callback, input.length);
  });
  const result = await readRecordMap(
    { scan: (q, v, consume) => db.scanRequest(db.pool, q, v, consume) },
    "SELECT fixed_key,fixed_value",
    ["key", "value"],
    ([key]) => key,
  );
  assert.deepEqual(result, Object.fromEntries(input));
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assertReleased(request);
});

test("stream and ordinary requests share bound parameter types and values", async (t) => {
  const db = adapter(),
    values = [
      new Date("2026-10-08T00:00:00Z"),
      true,
      3,
      0.25,
      "' Türkçe",
      null,
      undefined,
    ],
    parameters = [];
  t.mock.method(sql.Request.prototype, "_query", function (_text, callback) {
    parameters.push(this.parameters);
    if (this.stream) {
      this.emit("recordset", metadata);
      complete(callback);
    } else callback(null, [[]], {}, []);
  });
  assert.deepEqual(
    await db.scanRequest(db.pool, "SELECT @p0,@p1", values, () => {}),
    { rowCount: 0 },
  );
  await db.request(db.pool, "SELECT @p0,@p1", values);
  assert.deepEqual(parameters[0], parameters[1]);
  assert.equal(parameters[0].p0.type, sql.DateTime2);
  assert.equal(parameters[0].p1.type, sql.Bit);
  assert.equal(parameters[0].p2.type, sql.BigInt);
  assert.equal(parameters[0].p3.type, sql.Float);
  assert.equal(parameters[0].p4.type, sql.NVarChar);
  assert.equal(parameters[0].p6.value, null);
});

test("consumer failure cancels once, drains late errors/rows and keeps the original failure", async (t) => {
  const db = adapter(),
    original = Error("synthetic mapper failure");
  let request,
    consumed = 0,
    cancelled = 0,
    settled = false;
  t.mock.method(sql.Request.prototype, "cancel", function () {
    cancelled++;
    assert.equal(this, request);
    this.emit("error", Error("synthetic cancellation error"));
    throw Error("synthetic cancel hook failure");
  });
  t.mock.method(sql.Request.prototype, "_query", function (_text, callback) {
    request = this;
    this.emit("recordset", metadata);
    this.emit("row", ["first", 1]);
    setImmediate(() => {
      assert.equal(settled, false, "must wait for driver completion");
      this.emit("row", ["late", 2]);
      this.emit(
        "error",
        Object.assign(Error("cancelled"), { code: "ECANCEL" }),
      );
      complete(callback, 2);
    });
  });
  const pending = db
    .scanRequest(db.pool, "SELECT fixed_key,fixed_value", [], () => {
      consumed++;
      throw original;
    })
    .finally(() => {
      settled = true;
    });
  await assert.rejects(pending, (error) => error === original);
  assert.equal(consumed, 1);
  assert.equal(cancelled, 1);
  assertReleased(request);
});

test("SQL and timeout events reject after draining, even when the stream promise resolves", async (t) => {
  const db = adapter();
  for (const code of ["EREQUEST", "ETIMEOUT", "ECONNCLOSED"]) {
    const error = Object.assign(Error("synthetic driver failure"), { code });
    let request,
      consumed = 0,
      settled = false;
    const mock = t.mock.method(
      sql.Request.prototype,
      "_query",
      function (_text, callback) {
        request = this;
        this.emit("recordset", metadata);
        this.emit("row", ["first", 1]);
        this.emit("error", error);
        setImmediate(() => {
          assert.equal(settled, false);
          this.emit("error", Error("secondary error"));
          this.emit("row", ["late", 2]);
          complete(callback, 2);
        });
      },
    );
    await assert.rejects(
      db
        .scanRequest(
          db.pool,
          "SELECT fixed_key,fixed_value",
          [],
          () => consumed++,
        )
        .finally(() => {
          settled = true;
        }),
      (e) => e === error,
    );
    assert.equal(consumed, 1);
    assertReleased(request);
    mock.mock.restore();
  }
});

test("invalid scans, missing metadata and multiple resultsets cannot accept partial maps", async (t) => {
  const db = adapter();
  let calls = 0;
  const invalid = t.mock.method(sql.Request.prototype, "_query", () => {
    calls++;
  });
  for (const [text, values, consume] of [
    ["DELETE FROM kp_allocations", [], () => {}],
    ["SELECT 1; SELECT 2", [], () => {}],
    ["SELECT \0", [], () => {}],
    ["SELECT 1", null, () => {}],
    ["SELECT 1", [], null],
  ])
    await assert.rejects(
      db.scanRequest(db.pool, text, values, consume),
      /Invalid snapshot scan/,
    );
  assert.equal(calls, 0);
  invalid.mock.restore();
  for (const emit of [
    () => {},
    (r) => r.emit("row", ["before metadata", 1]),
    (r) => r.emit("recordset", {}),
    (r) => {
      r.emit("recordset", metadata);
      r.emit("row", ["wrong width"]);
    },
    (r) => {
      r.emit("recordset", metadata);
      r.emit("recordset", metadata);
    },
  ]) {
    let request;
    const mock = t.mock.method(
      sql.Request.prototype,
      "_query",
      function (_text, callback) {
        request = this;
        emit(this);
        complete(callback);
      },
    );
    await assert.rejects(
      db.scanRequest(db.pool, "SELECT fixed_key,fixed_value", [], () => {}),
      /SQL snapshot scan/,
    );
    assertReleased(request);
    mock.mock.restore();
  }
});

test("query startup failure releases scan listeners without masking the driver error", async (t) => {
  const db = adapter(),
    error = Error("synthetic startup failure");
  let request;
  t.mock.method(sql.Request.prototype, "query", function () {
    request = this;
    throw error;
  });
  await assert.rejects(
    db.scanRequest(db.pool, "SELECT 1", [], () => {}),
    (e) => e === error,
  );
  assertReleased(request);
});

test("missing completion or an unexpected buffered result fails closed", async (t) => {
  const db = adapter();
  for (const buffered of [false, true]) {
    let request;
    const mock = t.mock.method(
      sql.Request.prototype,
      "query",
      async function () {
        request = this;
        this.emit("recordset", metadata);
        this.emit("row", ["first", 1]);
        if (buffered) this.emit("done", {});
        return { recordsets: buffered ? [[]] : null };
      },
    );
    await assert.rejects(
      db.scanRequest(db.pool, "SELECT fixed_key,fixed_value", [], () => {}),
      /incomplete/,
    );
    assertReleased(request);
    mock.mock.restore();
  }
});

test("failed native scan is fully drained before locked transaction rollback", async (t) => {
  const db = adapter(),
    error = Error("synthetic consumer error");
  let owner,
    drained = false,
    rolledBack = 0;
  t.mock.method(sql.Transaction.prototype, "begin", async function () {
    owner = this;
  });
  t.mock.method(sql.Transaction.prototype, "commit", async () => {
    assert.fail("must not commit partial read");
  });
  t.mock.method(sql.Transaction.prototype, "rollback", async () => {
    assert.equal(drained, true);
    rolledBack++;
  });
  t.mock.method(sql.Request.prototype, "_query", function (text, callback) {
    assert.equal(this.parent, owner);
    if (text.startsWith("DECLARE @r")) return callback(null, [[]], {}, []);
    this.emit("recordset", metadata);
    this.emit("row", ["first", 1]);
    setImmediate(() => {
      drained = true;
      complete(callback, 1);
    });
  });
  await assert.rejects(
    db.transaction((c) =>
      c.scan("SELECT fixed_key,fixed_value", [], () => {
        throw error;
      }),
    ),
    (e) => e === error,
  );
  assert.equal(rolledBack, 1);
});
