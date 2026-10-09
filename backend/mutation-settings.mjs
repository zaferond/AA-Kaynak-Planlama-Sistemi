import { ident } from "./tables.mjs";

// Fixed columns and keys; never accept submitted SQL identifiers. JSON equality
// belongs to this validated transaction pair only, not a cross-request cache.
const fields = [
  ["legacy_archive", "legacyArchive", "null"],
  ["calendar_days", "workCalendar", "{}"],
  ["person_calendar", "personCalendar", "{}"],
];

export function prepareMutationSettings(before, valid) {
  const assignments = ["generation=generation+1"],
    values = [],
    metadataEquality = new Map();
  for (const [column, key, fallbackJson] of fields) {
    const oldValue = before[key],
      newValue = valid[key],
      oldRaw = JSON.stringify(oldValue),
      newRaw = JSON.stringify(newValue);
    // Raw equality differs from storage equality when a default is inserted.
    metadataEquality.set(key, oldRaw === newRaw);
    const oldJson = oldValue ? oldRaw : fallbackJson,
      newJson = newValue ? newRaw : fallbackJson;
    if (oldJson === newJson) continue;
    assignments.push(ident(column) + "=@p" + values.length);
    values.push(!newValue && fallbackJson === "null" ? null : newJson);
  }
  return { assignments, values, metadataEquality };
}
