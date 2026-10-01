import { randomUUID } from "node:crypto";
import { entityCollections } from "../shared/entity-kinds.ts";
import { publicUser } from "./auth.mjs";

function fields(before, after, path = [], out = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return out;
  if (
    (before === undefined && after === "") ||
    (after === undefined && before === "")
  )
    return out;
  const object = (value) => value !== null && typeof value === "object";
  if (object(before) || object(after)) {
    for (const key of new Set([
      ...Object.keys(object(before) ? before : {}),
      ...Object.keys(object(after) ? after : {}),
    ])) {
      fields(before?.[key], after?.[key], [...path, key], out);
    }
  } else out.push({ path, before: before ?? null, after: after ?? null });
  return out;
}
const indexed = (items) =>
  Object.fromEntries((items || []).map((item) => [item.id, item]));
const sanitized = (kind, value) => {
  if (value === undefined) return undefined;
  if (kind === "resource") {
    const { note, ...rest } = value;
    return rest;
  }
  if (kind === "personDay") {
    const { label, ...rest } = value;
    return rest;
  }
  return value;
};
export function auditEntries(
  before,
  after,
  actor,
  { beforeUsers = [], afterUsers = [] } = {},
) {
  const time = new Date().toISOString(),
    entries = [];
  const names = (collection) =>
    Object.fromEntries(
      [...(before[collection] || []), ...(after[collection] || [])].map(
        (item) => [item.id, item.name],
      ),
    );
  const resources = names("resources"),
    teams = names("teams"),
    projects = names("projects");
  const recordLabel = (kind, id, fallback) => {
    const [owner, projectOrDate, month] = id.split("|");
    if (kind === "allocation" || kind === "actual")
      return [
        (kind === "actual" ? resources : teams)[owner] || owner,
        projects[projectOrDate] || projectOrDate,
        month,
      ].join(" · ");
    if (kind === "workedHours" || kind === "personDay")
      return [resources[owner] || owner, projectOrDate].join(" · ");
    return fallback;
  };
  const collect = (kind, a = {}, b = {}) => {
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const old = sanitized(kind, a[id]),
        next = sanitized(kind, b[id]);
      const changes = fields(old, next);
      if (!changes.length) continue;
      const name =
        next?.name || old?.name || next?.description || old?.description || id;
      entries.push({
        id: randomUUID(),
        occurred_at: time,
        actor_id: actor._id,
        actor_name: actor.name || actor._id,
        kind,
        record_id: id,
        record_name: String(recordLabel(kind, id, name)).slice(0, 300),
        action:
          old === undefined
            ? "create"
            : next === undefined
              ? "delete"
              : "update",
        changes: JSON.stringify(changes),
      });
    }
  };
  for (const [kind, key] of Object.entries(entityCollections)) {
    const isMap = kind === "allocation" || kind === "actual";
    collect(
      kind,
      isMap ? before[key] : indexed(before[key]),
      isMap ? after[key] : indexed(after[key]),
    );
  }
  for (const [kind, key] of [
    ["workedHours", "actualWorkedHours"],
    ["calendar", "workCalendar"],
    ["personDay", "personCalendar"],
  ])
    collect(kind, before[key], after[key]);
  const leaders = (d) =>
    Object.fromEntries(
      (d.leaders || []).map((name) => [
        name,
        { name, managerName: d.leaderManagers?.[name] || "" },
      ]),
    );
  collect("leader", leaders(before), leaders(after));
  collect(
    "user",
    indexed(beforeUsers.map(publicUser)),
    indexed(afterUsers.map(publicUser)),
  );
  return entries;
}
