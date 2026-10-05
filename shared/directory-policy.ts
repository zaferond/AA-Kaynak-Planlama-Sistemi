import { fold, type Team } from "./model.ts";

const nameKey = (name: string) => fold(name.trim());

export function assertUniqueLeaderName(
  leaders: readonly string[],
  name: string,
  previousName?: string,
) {
  if (
    leaders.some(
      (leader) => leader !== previousName && nameKey(leader) === nameKey(name),
    )
  )
    throw Error("Bu isimde bir liderlik zaten var.");
}

export function assertUniqueTeamName(teams: readonly Team[], team: Team) {
  if (
    teams.some(
      (other) =>
        other.id !== team.id &&
        other.lead === team.lead &&
        nameKey(other.name) === nameKey(team.name),
    )
  )
    throw Error("Bu liderlik altında aynı isimde bir takım zaten var.");
}
