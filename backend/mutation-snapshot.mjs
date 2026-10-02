// Store.read builds these maps from numeric SQL columns. Their values cannot
// share mutable children; copying their own fields is enough to isolate edits.
export const numericSnapshotMaps = Object.freeze([
  "allocations",
  "actualAllocations",
  "actualWorkedHours",
  "actualPercentEntries",
  "revisions",
]);

export function cloneMutationSnapshot(data) {
  const nested = { ...data },
    maps = {};
  for (const key of numericSnapshotMaps) {
    if (!Object.hasOwn(data, key)) continue;
    const map = data[key];
    // Preserve full structuredClone behaviour for unexpected/invalid inputs.
    // Validation still decides whether the resulting model may be committed.
    if (
      !map ||
      (Object.getPrototypeOf(map) !== Object.prototype &&
        Object.getPrototypeOf(map) !== null)
    )
      return structuredClone(data);
    const copy = {};
    for (const id in map) {
      if (!Object.hasOwn(map, id)) continue;
      const value = map[id];
      if (typeof value !== "number") return structuredClone(data);
      if (id === "__proto__")
        Object.defineProperty(copy, id, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      else copy[id] = value;
    }
    maps[key] = copy;
    delete nested[key];
  }
  return { ...structuredClone(nested), ...maps };
}
