import type { directoryResponsibilityIndex } from "../../../shared/resource-roles.ts";
import { topLeader } from "../../../shared/leadership-hierarchy.ts";
import { ownValue } from "../../../shared/records.ts";
import type { Data, Team } from "../model.ts";
export type ReportGroup = {
  name: string;
  ids: string[];
  leader?: string;
  unitId?: string;
};
/** Group only the caller's authorized, filtered units. Standalone teams are
 * independent roots, rather than one fictitious "unassigned leadership". */
export function topLevelReportGroups(
  data: Pick<Data, "leaderParents">,
  teams: readonly Team[],
): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const team of teams) {
    const leader = topLeader(data, team.lead);
    const key = leader ? "leader:" + leader : "unit:" + team.id;
    let group = groups.get(key);
    if (!group) {
      group = leader
        ? { name: leader, leader, ids: [] }
        : { name: team.name, unitId: team.id, ids: [] };
      groups.set(key, group);
    }
    group.ids.push(team.id);
  }
  return [...groups.values()];
}
export function reportGroupManager(
  responsibility: ReturnType<typeof directoryResponsibilityIndex>,
  teams: readonly Team[],
  group: ReportGroup,
  teamReport: boolean,
) {
  if (!teamReport && !group.unitId)
    return ownValue(responsibility.leaders, group.leader || "") || "—";
  const unit = teams.find((team) => team.id === (group.unitId || group.ids[0]));
  if (!unit) return "—";
  return (
    (unit.kind === "leadership"
      ? ownValue(responsibility.leaders, unit.lead)
      : ownValue(responsibility.teams, unit.id)) || "—"
  );
}
