import { useMemo } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { fmt, monthLabel } from "../../format";
import ProjectResponsible from "../../ProjectResponsible";
import PlannedTableHeaders from "./PlannedTableHeaders";
import PlannedSummaryRows from "./PlannedSummaryRows";
import PlannedPhaseButton from "./PlannedPhaseButton";
import PlannedAllocationRow, {
  type PlannedRowProps,
} from "./PlannedAllocationRow";
import {
  actualRowsVisible,
  PlannedActualToggle,
  PlannedTeamBadge,
} from "./PlannedTeamLabels";
import { useWindowedSections } from "../workspace/useWindowedSections";
import type { WindowedSection } from "../workspace/useWindowedSections";
import type { PlannedAllocationProps } from "./types";
export default function PlannedAllocationTable(
  props: PlannedRowProps &
    Pick<
      PlannedAllocationProps,
      | "planTableRef"
      | "todayDate"
      | "labelWidth"
      | "monthWidth"
      | "groups"
      | "teams"
      | "projects"
      | "metric"
      | "projectIds"
      | "projectTotals"
    >,
) {
  const {
    planTableRef,
    view,
    todayDate,
    months,
    labelWidth,
    monthWidth,
    groups,
    teams,
    projects,
    projectTotals,
  } = props;
  const cellSet = useMemo(() => new Set(props.cells), [props.cells]);
  const sections: WindowedSection[] =
    view === "team"
      ? groups.flatMap((g) => {
          const t = teams[g.outer];
          return Array.from(
            { length: Math.ceil(g.inners.length / 20) },
            (_, part) => {
              const chunk = g.inners.slice(part * 20, (part + 1) * 20);
              const first = part === 0,
                last = (part + 1) * 20 >= g.inners.length;
              const key = `${t.id}:${part}`;
              return {
                key,
                height:
                  (first ? 76 : 0) +
                  chunk.length * (actualRowsVisible(props, t.id) ? 100 : 60) +
                  (last ? 126 : 0),
                render: () => (
                  <TableBody key={key} data-window-key={key}>
                    {first && (
                      <TableRow className="group">
                        <TableCell colSpan={months.length + 1}>
                          <div className="team-group-label">
                            <PlannedActualToggle team={t} {...props} />
                            <div>
                              <div className="team-heading">
                                <strong
                                  title={t.lead || "Liderlik eşleştirilmemiş"}
                                >
                                  {t.name}
                                </strong>
                                <PlannedTeamBadge team={t} {...props} />
                              </div>
                              <span>
                                Yönetici: {t.managerName || "Atanmamış"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {chunk.map((i) => (
                      <PlannedAllocationRow
                        key={t.id + projects[i].id}
                        team={t}
                        project={projects[i]}
                        cellSet={cellSet}
                        {...props}
                      />
                    ))}
                    {last && <PlannedSummaryRows {...props} teams={[t]} />}
                  </TableBody>
                ),
              };
            },
          );
        })
      : groups.map((g) => {
          const p = projects[g.outer];
          return {
            key: p.id,
            height:
              130 +
              g.inners.reduce(
                (sum, i) =>
                  sum + (actualRowsVisible(props, teams[i].id) ? 100 : 60),
                0,
              ),
            render: () => (
              <TableBody
                key={p.id}
                data-window-key={p.id}
                className="project-row-group"
                data-project-group={p.id}
              >
                <TableRow
                  className="group project-phase-group project-freeze-row"
                  data-project-heading={p.id}
                >
                  <TableCell className="project-group-name">
                    <strong>{p.name}</strong>
                    <ProjectResponsible project={p} />
                    <span>
                      {p.start} — {p.end}
                    </span>
                  </TableCell>
                  {months.map((m) => (
                    <TableCell key={m}>
                      <PlannedPhaseButton project={p} month={m} {...props} />
                    </TableCell>
                  ))}
                </TableRow>
                {g.inners.map((i) => (
                  <PlannedAllocationRow
                    key={teams[i].id + p.id}
                    team={teams[i]}
                    project={p}
                    cellSet={cellSet}
                    {...props}
                  />
                ))}
                <TableRow className="summary s2">
                  <TableCell>Bu projeye tahsis · seçili takımlar</TableCell>
                  {months.map((m) => (
                    <TableCell
                      key={m}
                      title={
                        monthLabel(m) +
                        ": " +
                        fmt(projectTotals[p.id + "|" + m] || 0)
                      }
                    >
                      {fmt(projectTotals[p.id + "|" + m] || 0)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            ),
          };
        });
  const windowedRows = useWindowedSections(
    planTableRef,
    sections,
    months.length + 1,
    `${view}|${props.density}|${months.join("|")}|${props.showAllActual}|${props.expandedActualTeams.join("|")}`,
  );
  return (
    <Table
      ref={planTableRef}
      stickyProjectRows={view === "project"}
      todayDate={todayDate}
      todayMonthsKey={months.join("|")}
      className={
        "matrix planning-grid allocation-grid" +
        (view === "project" ? " project-team-view" : "")
      }
      style={{
        width: labelWidth + months.length * monthWidth,
        minWidth: "100%",
      }}
    >
      <PlannedTableHeaders
        months={months}
        labelWidth={labelWidth}
        monthWidth={monthWidth}
        label={view === "team" ? "Takım / Proje" : "Proje / Takım"}
      />
      {windowedRows}
    </Table>
  );
}
