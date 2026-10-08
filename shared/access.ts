import type { Data } from "./model.ts";
import { actualTeamTotalIndex, createActualTeamIndex } from "./model.ts";
import { filterOwnRecords } from "./records.ts";
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
// View visibility also drives the optional SQL planning read. Write permission
// remains allowedTeam; an unassigned manager can view teams but cannot edit them.
export function visibleTeamScope(
  d: Pick<Data, "teams" | "leaders">,
  u: Principal,
) {
  const leaderNames = new Set(u.leaders.length ? u.leaders : d.leaders || []);
  const teams = d.teams.filter((t) => !!t.lead && leaderNames.has(t.lead)),
    ids = new Set(teams.map((t) => t.id));
  return { leaderNames, teams, ids };
}

// Candidate owners for personal actual data. A manager's historical team/month
// check still runs below; this owner list is a superset, never a new permission.
export function actualReadOwnerScope(
  d: Pick<Data, "teams" | "leaders" | "resources">,
  u: Principal,
  teamIds = visibleTeamScope(d, u).ids,
): string[] | undefined {
  if (u.role === "admin") return undefined;
  if (u.role === "normal") return u.resourceId ? [u.resourceId] : [];
  if (!u.leaders.length) return [];
  return d.resources
    .filter((r) => r.versions.some((v) => teamIds.has(v.team)))
    .map((r) => r.id);
}
export function scopeData(d: Data, u: Principal): Data {
  if (u.role === "admin") return d;
  const { leaderNames, teams, ids } = visibleTeamScope(d, u);
  const ownId = u.role === "normal" ? u.resourceId || "" : "";
  const managerCanSeePeople = u.role === "manager" && u.leaders.length > 0;
  const assignments = createActualTeamIndex(d.resources);
  const actualOwners = new Set(actualReadOwnerScope(d, u, ids));
  const canSeeResourceMonth = (resourceId: string, month: string) => {
    if (!actualOwners.has(resourceId)) return false;
    if (u.role === "normal") return true;
    if (!month) return false;
    const team = assignments.get(resourceId, month);
    return team !== undefined && ids.has(team);
  };
  const canSeeActual = (key: string, kind: "actual" | "workedHours") => {
    const parts = key.split("|"),
      resourceId = parts[0],
      month = parts[kind === "actual" ? 2 : 1];
    return canSeeResourceMonth(resourceId, month);
  };
  const actualEntries = (
    entries: Record<string, number> | undefined,
    kind: "actual" | "workedHours",
  ) => filterOwnRecords(entries, (key) => canSeeActual(key, kind));
  const canSeePersonDay = (key: string) => {
    const [resourceId, date] = key.split("|");
    return canSeeResourceMonth(resourceId, date?.slice(0, 7));
  };
  // Keep the existing ordinary-then-risk revision order with one enumeration.
  const riskKeys: string[] = [];
  const revisions = filterOwnRecords(d.revisions, (key) => {
    if (key.startsWith("risk:")) {
      riskKeys.push(key);
      return false;
    }
    return key.startsWith("allocation:")
      ? u.role === "manager" && ids.has(key.slice(11).split("|")[0])
      : key.startsWith("actual:")
        ? canSeeActual(key.slice(7), "actual")
        : key.startsWith("workedHours:")
          ? canSeeActual(key.slice(12), "workedHours")
          : key.startsWith("personDay:")
            ? canSeePersonDay(key.slice(10))
            : key === "calendar:shared";
  });
  for (const key of riskKeys) revisions[key] = d.revisions[key];

  return {
    ...d,
    users: undefined,
    legacyArchive: undefined,
    teams,
    leaders: (d.leaders || []).filter((l) => leaderNames.has(l)),
    leaderManagers: filterOwnRecords(d.leaderManagers, (name) =>
      leaderNames.has(name),
    ),
    resources: d.resources
      .filter((r) => r.id === ownId || r.versions.some((v) => ids.has(v.team)))
      .map((r) => ({
        ...r,
        name: managerCanSeePeople || r.id === ownId ? r.name : "",
        note: "",
        code: undefined,
        versions: r.versions.map((v) =>
          r.id === ownId || ids.has(v.team)
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
    allocations: filterOwnRecords(d.allocations, (key) =>
      ids.has(key.split("|")[0]),
    ),
    actualAllocations: actualEntries(d.actualAllocations, "actual"),
    actualWorkedHours: actualEntries(d.actualWorkedHours, "workedHours"),
    actualPercentEntries: actualEntries(d.actualPercentEntries, "actual"),
    personCalendar: filterOwnRecords(d.personCalendar, canSeePersonDay),
    actualTeamTotals: actualTeamTotalIndex(d, ids, assignments),
    revisions,
    risks: d.risks || [],
  };
}
