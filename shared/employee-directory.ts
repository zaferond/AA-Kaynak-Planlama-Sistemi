import {
  versionAt,
  isActualStatus,
  type Data,
  type Resource,
} from "./model.ts";
import { descendantLeaders } from "./leadership-hierarchy.ts";
import type { Principal } from "./access.ts";

export function employeeAssignment(
  data: Pick<Data, "resources" | "teams">,
  resourceId: string,
  month: string,
) {
  const resource = data.resources.find((person) => person.id === resourceId);
  const version = resource && versionAt(resource, month);
  const team = version && data.teams.find((team) => team.id === version.team);
  return resource && version && isActualStatus(version.status) && team
    ? { resource, version, team }
    : undefined;
}
export function directoryEmployees(
  data: Data,
  kind: "leader" | "team",
  id: string,
  month: string,
) {
  const leaders = kind === "leader" ? descendantLeaders(data, id) : undefined;
  return data.resources
    .flatMap((resource) => {
      const assignment = employeeAssignment(data, resource.id, month);
      return assignment &&
        (kind === "team"
          ? assignment.team.id === id
          : leaders!.has(assignment.team.lead))
        ? [assignment]
        : [];
    })
    .sort((a, b) => a.resource.name.localeCompare(b.resource.name, "tr"));
}
export function activityTeamScope(data: Data, user: Principal, month: string) {
  if (user.role === "admin") return data.teams;
  const own = employeeAssignment(data, user.resourceId || "", month);
  if (!own) return [];
  if (user.role === "normal")
    return data.teams.filter((team) => team.id === own.team.id);
  const leaders = descendantLeaders(data, own.team.lead);
  return own.team.lead
    ? data.teams.filter((team) => leaders.has(team.lead))
    : [];
}
