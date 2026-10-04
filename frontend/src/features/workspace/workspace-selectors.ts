import type { Data, Team, Project } from "../../model.ts";
import type { Principal } from "../../access.ts";
import { visibleActualInScope } from "../../../../shared/actual-visibility.ts";
import { groupPage, type Metric } from "../../metrics.ts";
import { monthLabel } from "../../format.ts";
import type { WorkspaceFilterValues } from "./workspace-options.ts";
export function selectWorkspaceScope(
  data: Data | null,
  user: Principal | null,
  {
    leads,
    teamIds,
    projectIds,
    start,
    months,
    currentMonth,
  }: Pick<
    WorkspaceFilterValues,
    "leads" | "teamIds" | "projectIds" | "start"
  > & { months: string[]; currentMonth: string },
) {
  const allLeads = data?.leaders || [];
  const availableTeams =
    data?.teams.filter((t) => !leads.length || leads.includes(t.lead)) || [];
  const teams = availableTeams.filter(
    (t) => !teamIds.length || teamIds.includes(t.id),
  );
  const projects =
    data?.projects.filter(
      (p) => !projectIds.length || projectIds.includes(p.id),
    ) || [];
  const ids = teams.map((t) => t.id);
  const actualTeamIds = new Set(ids);
  const leaderReportGroups = [...new Set(teams.map((t) => t.lead))].map(
    (lead) => ({
      name: lead || "Liderlik eşleştirilmemiş",
      leader: lead,
      ids: teams.filter((t) => t.lead === lead).map((t) => t.id),
    }),
  );
  const teamReportGroups = teams.map((t) => ({ name: t.name, ids: [t.id] }));
  const availablePeople =
    data?.resources
      .filter((r) =>
        months.some((m) => {
          return !!visibleActualInScope(
            r,
            m,
            currentMonth,
            actualTeamIds,
            user?.role === "normal" ? user.resourceId : undefined,
          );
        }),
      )
      .map((r) => ({ id: r.id, name: r.name })) || [];
  const capacityFilters = [
    { label: "Liderlik", values: leads, active: leads.length > 0 },
    {
      label: "Takım",
      values: teamIds.map(
        (id) => data?.teams.find((t) => t.id === id)?.name || id,
      ),
      active: teamIds.length > 0,
    },
    {
      label: "Proje",
      values: projectIds.map(
        (id) => data?.projects.find((p) => p.id === id)?.name || id,
      ),
      active: projectIds.length > 0,
    },
    { label: "Başlangıç Ayı", values: [monthLabel(start)], active: true },
  ];
  const leaderItems = allLeads.map((lead) => ({ id: lead, name: lead }));
  return {
    allLeads,
    leaderItems,
    availableTeams,
    teams,
    projects,
    ids,
    leaderReportGroups,
    teamReportGroups,
    availablePeople,
    capacityFilters,
  };
}
export function workspaceMetric(
  cache: Record<string, Metric>,
  tids: string[],
  month: string,
): Metric {
  return tids.reduce(
    (sum, id) => {
      const cell = cache[id + "|" + month] || { current: 0, total: 0 };
      return {
        current: sum.current + cell.current,
        total: sum.total + cell.total,
      };
    },
    { current: 0, total: 0 },
  );
}
export function selectWorkspacePages(
  teams: Team[],
  projects: Project[],
  {
    count,
    view,
    planPage,
    projectPage,
  }: { count: number; view: string; planPage: number; projectPage: number },
) {
  const planPageSize = Math.max(20, Math.min(100, Math.floor(1200 / count)));
  const effectivePlanPage = Math.min(
    planPage,
    Math.max(0, Math.ceil((teams.length * projects.length) / planPageSize) - 1),
  );
  const planGroups = groupPage(
    view === "team" ? teams.length : projects.length,
    view === "team" ? projects.length : teams.length,
    effectivePlanPage,
    planPageSize,
  );
  const effectiveProjectPage = Math.min(
    projectPage,
    Math.max(0, Math.ceil(projects.length / 20) - 1),
  );
  const visiblePlanRows = planGroups.flatMap((group) =>
    group.inners.map((index) =>
      view === "team"
        ? teams[group.outer].id + "|" + projects[index].id
        : teams[index].id + "|" + projects[group.outer].id,
    ),
  );
  return {
    planPageSize,
    effectivePlanPage,
    planGroups,
    effectiveProjectPage,
    visiblePlanRows,
  };
}
