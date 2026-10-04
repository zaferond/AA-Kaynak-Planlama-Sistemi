import { Fragment, useMemo } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { fmt, monthLabel } from "../../format";
import ProjectResponsible from "../../ProjectResponsible";
import PlannedTableHeaders from "./PlannedTableHeaders";
import PlannedSummaryRows from "./PlannedSummaryRows";
import PlannedPhaseButton from "./PlannedPhaseButton";
import PlannedAllocationRow, {
  type PlannedRowProps,
} from "./PlannedAllocationRow";
import { PlannedActualToggle, PlannedTeamBadge } from "./PlannedTeamLabels";
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
      {view === "team" ? (
        <TableBody>
          {groups.map((g) => {
            const t = teams[g.outer];
            return (
              <Fragment key={t.id}>
                <TableRow className="group">
                  <TableCell colSpan={months.length + 1}>
                    <div className="team-group-label">
                      <PlannedActualToggle team={t} {...props} />
                      <div>
                        <div className="team-heading">
                          <strong title={t.lead || "Liderlik eşleştirilmemiş"}>
                            {t.name}
                          </strong>
                          <PlannedTeamBadge team={t} {...props} />
                        </div>
                        <span>Yönetici: {t.managerName || "Atanmamış"}</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
                {g.inners.map((i) => (
                  <PlannedAllocationRow
                    key={t.id + projects[i].id}
                    team={t}
                    project={projects[i]}
                    cellSet={cellSet}
                    {...props}
                  />
                ))}
                <PlannedSummaryRows {...props} teams={[t]} />
              </Fragment>
            );
          })}
        </TableBody>
      ) : (
        groups.map((g) => {
          const p = projects[g.outer];
          return (
            <TableBody
              key={p.id}
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
          );
        })
      )}
    </Table>
  );
}
