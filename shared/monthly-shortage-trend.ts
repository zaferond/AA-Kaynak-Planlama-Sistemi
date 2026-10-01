import type { Metric } from "./metrics.ts";

export type MonthlyShortagePoint = {
  month: string;
  average: number;
  total: number;
  teamCount: number;
};

/** Average each team's positive gap; surpluses in other teams do not hide a shortage. */
export function buildMonthlyShortageTrend(
  capacity: Record<string, Metric>,
  teamIds: string[],
  months: string[],
): MonthlyShortagePoint[] {
  return months.map((month) => {
    const total = teamIds.reduce((sum, teamId) => {
      const value = capacity[teamId + "|" + month];
      return sum + Math.max(0, (value?.total || 0) - (value?.current || 0));
    }, 0);
    return {
      month,
      total,
      average: teamIds.length ? total / teamIds.length : 0,
      teamCount: teamIds.length,
    };
  });
}
