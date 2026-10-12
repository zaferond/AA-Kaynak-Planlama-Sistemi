import type { Data } from "./model.ts";
import { ownValue } from "./records.ts";

type Directory = Pick<Data, "leaders" | "leaderParents">;
export function validateLeaderParents(data: Directory) {
  const names = new Set(data.leaders || []);
  for (const [name, parent] of Object.entries(data.leaderParents || {})) {
    if (!names.has(name) || !names.has(parent))
      throw Error("Üst liderlik bulunamadı.");
    const visited = new Set([name]);
    let next: string | undefined = parent;
    while (next) {
      if (visited.has(next))
        throw Error("Liderlik kendisine veya alt liderliğine bağlanamaz.");
      visited.add(next);
      next = ownValue(data.leaderParents, next);
    }
  }
}
export function topLeader(data: Pick<Data, "leaderParents">, name: string) {
  const visited = new Set<string>();
  let current = name;
  while (current && !visited.has(current)) {
    visited.add(current);
    const parent = ownValue(data.leaderParents, current);
    if (!parent) break;
    current = parent;
  }
  return current;
}
export function descendantLeaders(data: Directory, root: string) {
  const result = new Set<string>(root ? [root] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of data.leaders || []) {
      const parent = ownValue(data.leaderParents, name);
      if (parent && result.has(parent) && !result.has(name)) {
        result.add(name);
        changed = true;
      }
    }
  }
  return result;
}
export function visibleLeaderParents(data: Directory, names: Iterable<string>) {
  const entries = new Map<string, string>();
  for (const name of names) {
    const visited = new Set<string>();
    let current = name;
    while (current && !visited.has(current)) {
      visited.add(current);
      const parent = ownValue(data.leaderParents, current);
      if (!parent) break;
      entries.set(current, parent);
      current = parent;
    }
  }
  return Object.fromEntries(entries);
}
