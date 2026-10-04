import { ownValue } from "../../../../shared/records.ts";
import {
  isWorkingStatus,
  versionAt,
  type Data,
  type Team,
} from "../../model.ts";
import { resourceMonthFraction } from "../../resource-dates.ts";
import { capacityStatus } from "../../capacity-status.ts";
import type { Metric } from "../../metrics.ts";
import type { ResourceReportGroup } from "../../resource-report-export.ts";
import type { ReportGroup } from "../RemainingResourceTable";
export function resourceReportFilterSummary(
  leads: readonly string[],
  teamIds: readonly string[],
) {
  return [
    "Liderlik: " + (leads.length ? leads.length + " seçili" : "Tümü"),
    "Takım: " + (teamIds.length ? teamIds.length + " seçili" : "Tümü"),
  ].join(" · ");
}
/** Report payload uses the selected start month for personnel and all-project metrics for remaining capacity. */
export function buildResourceReportGroups(
  data: Data,
  teams: readonly Team[],
  groups: readonly ReportGroup[],
  start: string,
  months: string[],
  metric: (ids: string[], month: string) => Metric,
  teamReport: boolean,
): ResourceReportGroup[] {
  return groups.map((group) => ({
    name: group.name,
    manager: teamReport
      ? teams.find((t) => t.id === group.ids[0])?.managerName || "—"
      : ownValue(data.leaderManagers, group.leader || "") || "—",
    personnel: data.resources.filter((r) => {
      const v = versionAt(r, start);
      return (
        !!v &&
        group.ids.includes(v.team) &&
        v.included &&
        isWorkingStatus(v.status) &&
        resourceMonthFraction(v, start) > 0
      );
    }).length,
    months: months.map((month) => {
      const value = metric(group.ids, month);
      return {
        remaining: value.current - value.total,
        status: capacityStatus(value.current, value.total).className,
      };
    }),
  }));
}
