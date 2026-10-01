import { entityCollections } from "../shared/entity-kinds.ts";

const indexed = (items = []) =>
  Object.fromEntries(items.map((item) => [item.id, item]));
const ownValue = (object, key) =>
  Object.hasOwn(object, key) ? object[key] : undefined;

export function recordChanges(before = {}, after = {}) {
  const changed = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const previous = ownValue(before, id),
      value = ownValue(after, id);
    if (
      previous === value ||
      JSON.stringify(previous) === JSON.stringify(value)
    )
      continue;
    changed.push({ id, before: previous, value });
  }
  return changed;
}

// Full validated snapshots, not the submitted command list: normalization and
// cascading changes must also reach persistence and auditing. No global cache.
export function dataChanges(before, after) {
  const changed = {};
  for (const [kind, collection] of Object.entries(entityCollections)) {
    const isMap = kind === "allocation" || kind === "actual";
    changed[kind] = recordChanges(
      isMap ? before[collection] : indexed(before[collection]),
      isMap ? after[collection] : indexed(after[collection]),
    );
  }
  for (const [kind, collection] of [
    ["workedHours", "actualWorkedHours"],
    ["percent", "actualPercentEntries"],
    ["calendar", "workCalendar"],
    ["personDay", "personCalendar"],
  ])
    changed[kind] = recordChanges(before[collection], after[collection]);

  const leaders = (data) =>
    Object.fromEntries(
      (data.leaders || []).map((name) => [
        name,
        { name, managerName: ownValue(data.leaderManagers || {}, name) || "" },
      ]),
    );
  changed.leader = recordChanges(leaders(before), leaders(after));
  return changed;
}
