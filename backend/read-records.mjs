import { table, tableSpec, ident } from "./tables.mjs";
import { DIRECTORY_REVISION_KEY } from "../shared/directory-policy.ts";
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
  parameters = [],
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
    const result = await c.scan(sql, parameters, consume);
    if (result?.rowCount !== consumedRows)
      throw Error("SQL satır okuması tamamlanamadı.");
  } else {
    const { rows } = await c.query(sql, parameters);
    for (const row of rows) consume(columns.map((column) => row[column]));
  }
  return records;
}

// SQLite can return the complete composite key as one text value, reducing
// WASM-to-JS column decoding. Other adapters keep their original column types.
export async function readCompositeMap(
  c,
  provider,
  name,
  valueColumn,
  planningTeams,
) {
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
  let where = "",
    parameters = [];
  if (planningTeams !== undefined) {
    if (
      name !== "allocations" ||
      !Array.isArray(planningTeams) ||
      !planningTeams.every((id) => typeof id === "string")
    )
      throw Error("Invalid planning read scope");
    const ids = [...new Set(planningTeams)];
    // Stay below SQLite's conservative 999 / MSSQL's 2100 bind limits. Larger
    // scopes fall back to the complete read, then scopeData; never truncate.
    if (ids.length <= 900) {
      parameters = ids;
      where = ids.length
        ? ` WHERE [team_id] IN (${ids.map((_, i) => "@p" + i).join(",")})`
        : " WHERE 1=0";
    }
  }
  if (provider === "sqljs") {
    const key = keys.map(ident).join("||'|'||");
    // Filtered index seeks group by team. Preserve the existing table-scan
    // insertion order for JSON, compression and downstream accumulation.
    const order = where ? " ORDER BY rowid" : "";
    return readRecordMap(
      c,
      `SELECT ${key} AS [record_key],${ident(valueColumn)} FROM ${table(name)}${where}${order}`,
      ["record_key", valueColumn],
      firstValue,
      identity,
      parameters,
    );
  }
  const columns = [...keys, valueColumn];
  return readRecordMap(
    c,
    `SELECT ${columns.map(ident).join(",")} FROM ${table(name)}${where}`,
    columns,
    (values) =>
      keys.length === 2
        ? values[0] + "|" + values[1]
        : values[0] + "|" + values[1] + "|" + values[2],
    identity,
    parameters,
  );
}

// Only remove planned revision rows that scopeData cannot expose. Keep every
// special @ namespace (including deleted risks/calendar/person/actual records),
// and leave the final resource-month visibility check to scopeData.
export async function readRevisionMap(c, provider, planningTeams) {
  if (!["sqljs", "mssql"].includes(provider))
    throw Error("Invalid revision read provider");
  let where = "",
    parameters = [];
  if (planningTeams !== undefined) {
    if (
      !Array.isArray(planningTeams) ||
      !planningTeams.every((id) => typeof id === "string")
    )
      throw Error("Invalid revision read scope");
    const ids = [...new Set(planningTeams)];
    // Large/legacy scopes keep complete reads; never truncate a team's revisions.
    if (ids.length <= 900 && !ids.some((id) => id.includes("|"))) {
      parameters = ids;
      const team =
        provider === "sqljs"
          ? "substr([record_id],1,instr([record_id]||'|','|')-1)"
          : "LEFT([record_id],CHARINDEX('|',[record_id]+'|')-1) COLLATE Latin1_General_100_BIN2";
      where =
        " WHERE ([kind]<>'allocation' OR [record_id] LIKE '@%'" +
        (ids.length
          ? ` OR ${team} IN (${ids.map((_, i) => "@p" + i).join(",")})`
          : "") +
        ")";
    }
  }
  const order = where && provider === "sqljs" ? " ORDER BY rowid" : "";
  return readRecordMap(
    c,
    "SELECT kind,record_id,revision FROM kp_revisions" + where + order,
    ["kind", "record_id", "revision"],
    revisionRecordKey,
    Number,
    parameters,
  );
}

export function revisionRecordKey(values) {
  const kind = values[0],
    id = values[1];
  if (kind === "allocation" && id === "@directory:shared")
    return DIRECTORY_REVISION_KEY;
  return kind === "allocation" && id.startsWith("@riskSystem:")
    ? "riskSystem:" + id.slice(12)
    : kind === "allocation" && id.startsWith("@risk:")
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
