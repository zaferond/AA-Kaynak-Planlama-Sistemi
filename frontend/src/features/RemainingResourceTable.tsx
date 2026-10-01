import {
  TimelineMonthHead,
  TimelineYearRow,
} from "../components/TimelineHeaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RefObject } from "react";
import { capacityStatus } from "../capacity-status";
import MemberBadge from "../components/MemberBadge";
import { fmt, monthLabel } from "../format";
import type { Metric } from "../metrics";
import type { Data, Team } from "../model";
export type ReportGroup = { name: string; ids: string[]; leader?: string };
type Props = {
  groups: ReportGroup[];
  teamReport: boolean;
  data: Data | null;
  teams: Team[];
  months: string[];
  monthWidth: number;
  todayDate: string;
  currentMonth: string;
  currentTeamMembers: Record<string, string[]>;
  metric: (ids: string[], month: string) => Metric;
  tableRef: RefObject<HTMLTableElement | null>;
};
export default function RemainingResourceTable({
  groups,
  teamReport,
  data,
  teams,
  months,
  monthWidth,
  todayDate,
  currentMonth,
  currentTeamMembers,
  metric,
  tableRef,
}: Props) {
  const memberBadge = (label: string, members: string[]) => (
    <MemberBadge label={label} members={members} currentMonth={currentMonth} />
  );
  const years = [...new Set(months.map((month) => month.slice(0, 4)))];
  function reportYearRow() {
    return (
      <TimelineYearRow
        years={months.map((month) => month.slice(0, 4))}
        labelColumns={2}
      />
    );
  }
  function reportMonthHead(month: string) {
    return <TimelineMonthHead key={month} month={month} years={years} />;
  }
  function reportRows(
    groups: { name: string; ids: string[]; leader?: string }[],
    teamReport = false,
  ) {
    return (
      <>
        <Table
          ref={tableRef}
          todayDate={todayDate}
          todayMonthsKey={months.join("|")}
          className={
            "remaining-report " + (teamReport ? "team-report" : "leader-report")
          }
          style={{ width: 350 + months.length * monthWidth, minWidth: "100%" }}
        >
          <colgroup>
            <col style={{ width: 110 }} />
            <col style={{ width: 240 }} />
            {months.map((m) => (
              <col key={m} style={{ width: monthWidth }} />
            ))}
          </colgroup>
          <TableHeader>
            {reportYearRow()}
            <TableRow>
              <TableHead>Yönetici</TableHead>
              <TableHead>{teamReport ? "Takım" : "Liderlik"}</TableHead>
              {months.map(reportMonthHead)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow
                key={
                  (teamReport ? "team:" : "leader:") +
                  (teamReport ? g.ids[0] : g.leader || g.name)
                }
              >
                <TableCell>
                  {teamReport
                    ? teams.find((t) => t.id === g.ids[0])?.managerName || "—"
                    : data?.leaderManagers?.[g.leader || ""] || "—"}
                </TableCell>
                <TableCell>
                  <span className="report-unit-title">
                    <span>{g.name}</span>
                    {memberBadge(
                      g.name,
                      g.ids
                        .flatMap((id) => currentTeamMembers[id] || [])
                        .sort((a, b) => a.localeCompare(b, "tr")),
                    )}
                  </span>
                </TableCell>
                {months.map((m) => {
                  const c = metric(g.ids, m),
                    remaining = c.current - c.total;
                  return (
                    <TableCell
                      key={m}
                      className={capacityStatus(c.current, c.total).className}
                      title={
                        monthLabel(m) +
                        ": " +
                        fmt(remaining) +
                        " · " +
                        capacityStatus(c.current, c.total).label
                      }
                    >
                      {fmt(remaining)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!groups.length && (
          <p className="emptymsg">Bu filtrelere uygun birim yok.</p>
        )}
        <footer className="tablefoot">
          <span>Kalan Kaynak · aylık kişi eşdeğeri</span>
          <span>
            Üye sayısı: bu ay Aktif Çalışan, Saat Ücretli ve Gear Up kayıtları.
          </span>
        </footer>
      </>
    );
  }

  return reportRows(groups, teamReport);
}
