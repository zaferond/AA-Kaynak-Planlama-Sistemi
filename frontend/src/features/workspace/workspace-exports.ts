import type { Data, Team, Project } from "../../model";
import {
  downloadActualAllocations,
  downloadPlannedAllocations,
} from "../../allocation-export";
import { downloadProjects } from "../../project-export";
import { downloadResourceReport } from "../../resource-report-export";
import type { Principal } from "../../access";
import type { Metric } from "../../metrics";
import type { ReportGroup } from "../RemainingResourceTable";
import type { WorkspaceDensity } from "../WorkspaceNavigation";
import {
  buildResourceReportGroups,
  resourceReportFilterSummary,
} from "./resource-report-data";
type Props = {
  data: Data | null;
  actualMonthSummaries?: Record<
    string,
    import("../../../../shared/actual-months").ActualMonthSummary
  >;
  user: Principal | null;
  tab: string;
  teams: Team[];
  projects: Project[];
  months: string[];
  density: WorkspaceDensity;
  projectWeekly: boolean;
  showProjectCodes: boolean;
  currentMonth: string;
  start: string;
  personIds: string[];
  leads: string[];
  teamIds: string[];
  leaderReportGroups: ReportGroup[];
  teamReportGroups: ReportGroup[];
  metric: (ids: string[], month: string) => Metric;
  setError: (message: string) => void;
};
/** Dispatch only the current authorized view to the existing workbook writers. */
export function createWorkspaceExports({
  data,
  actualMonthSummaries,
  user,
  tab,
  teams,
  projects,
  months,
  density,
  projectWeekly,
  showProjectCodes,
  currentMonth,
  start,
  personIds,
  leads,
  teamIds,
  leaderReportGroups,
  teamReportGroups,
  metric,
  setError,
}: Props) {
  function exportResourceReport() {
    if (!data) return;
    downloadResourceReport(
      months,
      buildResourceReportGroups(
        data,
        teams,
        leaderReportGroups,
        start,
        months,
        metric,
        false,
      ),
      buildResourceReportGroups(
        data,
        teams,
        teamReportGroups,
        start,
        months,
        metric,
        true,
      ),
      resourceReportFilterSummary(leads, teamIds),
    );
  }
  function exportCurrentTab() {
    try {
      if (tab === "projects")
        downloadProjects(
          projects,
          months,
          density,
          projectWeekly,
          showProjectCodes,
        );
      else if (tab === "overview") exportResourceReport();
      else if (tab === "plan" && data)
        downloadPlannedAllocations(data, teams, projects, months);
      else if (tab === "actual" && data)
        downloadActualAllocations(
          data,
          teams,
          projects,
          months,
          currentMonth,
          personIds,
          user?.role !== "admin" ? user?.resourceId : undefined,
          actualMonthSummaries,
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return { exportCurrentTab };
}
