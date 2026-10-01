import type { Data } from "./model.ts";
import { actualTeamTotalIndex, actualVersionAt } from "./model.ts";
export type Role = "admin" | "manager" | "normal";
export type Credential = {
  salt: string;
  iv: string;
  wrappedKey: string;
  version: string;
};
export type Account = {
  id: string;
  username: string;
  name: string;
  role: Role;
  resourceId?: string;
  leaders: string[];
  active: boolean;
  credential?: Credential;
};
export const ROOT_ADMIN_ID = "root-admin";
export type Principal = Omit<Account, "credential">;
export function publicAccount(a: Account): Principal {
  const { credential, ...p } = a;
  return structuredClone(p);
}
export function allowedTeam(d: Data, u: Principal, id: string) {
  return (
    u.role === "admin" ||
    (u.role === "manager" &&
      d.teams.some(
        (t) => t.id === id && !!t.lead && u.leaders.includes(t.lead),
      ))
  );
}
export function scopeData(d: Data, u: Principal): Data {
  if (u.role === "admin") return d;
  const leaderNames = new Set(u.leaders.length ? u.leaders : d.leaders || []);
  const teams = d.teams.filter((t) => !!t.lead && leaderNames.has(t.lead)),
    ids = new Set(teams.map((t) => t.id));
  const ownId = u.role === "normal" ? u.resourceId || "" : "";
  const managerCanSeePeople = u.role === "manager" && u.leaders.length > 0;
  const resourcesById = new Map(
    d.resources.map((resource) => [resource.id, resource]),
  );
  const canSeeActual = (key: string, kind: "actual" | "workedHours") => {
    const parts = key.split("|"),
      resourceId = parts[0],
      month = parts[kind === "actual" ? 2 : 1];
    if (u.role === "normal") return resourceId === ownId;
    if (!managerCanSeePeople || !month) return false;
    const resource = resourcesById.get(resourceId);
    return !!resource && ids.has(actualVersionAt(resource, month)?.team || "");
  };
  const actualEntries = (
    entries: Record<string, number> | undefined,
    kind: "actual" | "workedHours",
  ) =>
    Object.fromEntries(
      Object.entries(entries || {}).filter(([key]) => canSeeActual(key, kind)),
    );
  const canSeePersonDay = (key: string) => {
    const [resourceId, date] = key.split("|");
    return u.role === "normal"
      ? resourceId === ownId
      : managerCanSeePeople &&
          !!resourcesById.get(resourceId) &&
          ids.has(
            actualVersionAt(resourcesById.get(resourceId)!, date.slice(0, 7))
              ?.team || "",
          );
  };
  return {
    ...d,
    users: undefined,
    legacyArchive: undefined,
    teams,
    leaders: (d.leaders || []).filter((l) => leaderNames.has(l)),
    leaderManagers: Object.fromEntries(
      Object.entries(d.leaderManagers || {}).filter(([name]) =>
        leaderNames.has(name),
      ),
    ),
    resources: d.resources
      .filter((r) => r.versions.some((v) => ids.has(v.team)))
      .map((r) => ({
        ...r,
        name: managerCanSeePeople || r.id === ownId ? r.name : "",
        note: "",
        code: undefined,
        versions: r.versions.map((v) =>
          ids.has(v.team)
            ? v
            : {
                effective: v.effective,
                team: "",
                lead: "",
                status: "",
                included: false,
                amount: 0,
                start: "",
                end: "",
              },
        ),
      })),
    allocations: Object.fromEntries(
      Object.entries(d.allocations).filter(([k]) => ids.has(k.split("|")[0])),
    ),
    actualAllocations: actualEntries(d.actualAllocations, "actual"),
    actualWorkedHours: actualEntries(d.actualWorkedHours, "workedHours"),
    actualPercentEntries: actualEntries(d.actualPercentEntries, "actual"),
    personCalendar: Object.fromEntries(
      Object.entries(d.personCalendar || {}).filter(([key]) =>
        canSeePersonDay(key),
      ),
    ),
    actualTeamTotals: actualTeamTotalIndex(d, ids),
    revisions: Object.assign(
      Object.fromEntries(
        Object.entries(d.revisions).filter(([key]) =>
          key.startsWith("allocation:")
            ? u.role === "manager" && ids.has(key.slice(11).split("|")[0])
            : key.startsWith("actual:")
              ? canSeeActual(key.slice(7), "actual")
              : key.startsWith("workedHours:")
                ? canSeeActual(key.slice(12), "workedHours")
                : key.startsWith("personDay:")
                  ? canSeePersonDay(key.slice(10))
                  : key === "calendar:shared",
        ),
      ),
      {
        ...Object.fromEntries(
          Object.entries(d.revisions).filter(([key]) =>
            key.startsWith("risk:"),
          ),
        ),
      },
    ),
    risks: d.risks || [],
  };
}
