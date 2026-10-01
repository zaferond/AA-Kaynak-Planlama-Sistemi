import { table, tableSpec, ident } from "./tables.mjs";
const identity = (value) => value;
const firstValue = (values) => values[0];

// SQL and column names come from fixed Store queries. Adapters without scan
// retain their ordinary query contract; both paths build the same record map.
export async function readRecordMap(
  c,
  sql,
  columns,
  recordKey,
  convert = identity,
) {
  const records = {},
    valueIndex = columns.length - 1;
  let consumedRows = 0;
  const consume = (values) => {
    const key = recordKey(values),
      value = convert(values[valueIndex]);
    if (key === "__proto__")
      Object.defineProperty(records, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    else records[key] = value;
    consumedRows++;
  };
  if (typeof c.scan === "function") {
    const result = await c.scan(sql, [], consume);
    if (result?.rowCount !== consumedRows)
      throw Error("SQL satır okuması tamamlanamadı.");
  } else {
    const { rows } = await c.query(sql);
    for (const row of rows) consume(columns.map((column) => row[column]));
  }
  return records;
}

// SQLite can return the complete composite key as one text value, reducing
// WASM-to-JS column decoding. Other adapters keep their original column types.
export async function readCompositeMap(c, provider, name, valueColumn) {
  const spec = tableSpec(name),
    keys = spec.key;
  if (
    !["sqljs", "mssql"].includes(provider) ||
    ![2, 3].includes(keys.length) ||
    ![...keys, valueColumn].every((column) =>
      Object.hasOwn(spec.columns, column),
    )
  )
    throw Error("Invalid composite map specification");
  if (provider === "sqljs") {
    const key = keys.map(ident).join("||'|'||");
    return readRecordMap(
      c,
      `SELECT ${key} AS [record_key],${ident(valueColumn)} FROM ${table(name)}`,
      ["record_key", valueColumn],
      firstValue,
    );
  }
  const columns = [...keys, valueColumn];
  return readRecordMap(
    c,
    `SELECT ${columns.map(ident).join(",")} FROM ${table(name)}`,
    columns,
    (values) =>
      keys.length === 2
        ? values[0] + "|" + values[1]
        : values[0] + "|" + values[1] + "|" + values[2],
  );
}

export function revisionRecordKey(values) {
  const kind = values[0],
    id = values[1];
  return kind === "allocation" && id.startsWith("@risk:")
    ? "risk:" + id.slice(6)
    : kind === "allocation" && id.startsWith("@actual:")
      ? "actual:" + id.slice(8)
      : kind === "allocation" && id.startsWith("@worked:")
        ? "workedHours:" + id.slice(8)
        : kind === "allocation" && id.startsWith("@calendar:")
          ? "calendar:" + id.slice(10)
          : kind === "allocation" && id.startsWith("@person:")
            ? "personDay:" + id.slice(8)
            : kind + ":" + id;
}
