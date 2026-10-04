import React from "react";
import { CalendarDays } from "lucide-react";
import type { Data, Project, Resource } from "../../model";
import { phaseStyle } from "../../model";
import { ACTUAL_FTE_TOLERANCE } from "../../../../shared/actual-months.ts";
import { ActualAmount as Amount } from "../ActualAllocationInputs";
import ProjectResponsible from "../../ProjectResponsible";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { workdaysInMonth, type ActualUnit } from "../../actual-units";
import { fullMonthFormat, numberFormat } from "./format";
import type { ActualAllocationView } from "./useActualAllocationView";
import type { ActualCapacityDialog } from "./useActualCapacityDialog";
import type {
  ActualAllocationSave,
  ActualCellSelection,
  ActualPhaseDetail,
} from "./types";

export default function ActualAllocationTable({
  data,
  projects,
  months,
  currentMonth,
  todayDate,
  unit,
  view,
  selectedCell,
  selectHoursContext,
  clearSelection,
  save,
  openLimit,
  onPhaseDetail,
  onOpenPersonalCalendar,
}: {
  data: Data;
  projects: Project[];
  months: string[];
  currentMonth: string;
  todayDate: string;
  unit: ActualUnit;
  view: ActualAllocationView;
  selectedCell: ActualCellSelection | null;
  selectHoursContext: (resourceId: string, month: string, key: string) => void;
  clearSelection: () => void;
  save: ActualAllocationSave;
  openLimit: ActualCapacityDialog["openLimit"];
  onPhaseDetail: (detail: ActualPhaseDetail) => void;
  onOpenPersonalCalendar: (resource: Resource) => void;
}) {
  const monthWidth = 76;
  const { people, eligible, groups, years, actualMonths, personMonthTotals } =
    view;
  const calendarTotals = (resourceId: string, month: string) =>
    actualMonths.get(resourceId, month);
  const effectiveHours = (resourceId: string, month: string) =>
    actualMonths.get(resourceId, month).effectiveHours;
  function amountFor(resource: Resource, project: Project, month: string) {
    return (
      data.actualAllocations?.[resource.id + "|" + project.id + "|" + month] ||
      0
    );
  }
  return (
    <Table
      stickyProjectRows
      todayDate={todayDate}
      todayMonthsKey={months.join("|")}
      className="matrix planning-grid allocation-grid"
      style={{ width: 200 + months.length * monthWidth }}
    >
      <colgroup>
        <col style={{ width: 200 }} />
        {months.map((month) => (
          <col key={month} style={{ width: monthWidth }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow className="yearrow">
          <TableHead>Yıl</TableHead>
          {years.map((year, index) => (
            <TableHead
              key={year}
              colSpan={months.filter((month) => month.startsWith(year)).length}
              className={"year-band-" + (index % 6)}
            >
              {year}
            </TableHead>
          ))}
        </TableRow>
        <TableRow>
          <TableHead>Proje / Kişi</TableHead>
          {months.map((month) => (
            <TableHead
              key={month}
              data-month={month}
              className={
                "monthhead year-band-" + (years.indexOf(month.slice(0, 4)) % 6)
              }
              title={
                month +
                " · " +
                workdaysInMonth(month) +
                " hafta içi gün · ortak takvime göre saat hesabı"
              }
            >
              <span>
                {fullMonthFormat.format(new Date(month + "-01T12:00:00"))}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      {groups.map((group) => {
        const project = projects[group.outer];
        return (
          <TableBody
            key={project.id}
            className="project-row-group"
            data-project-group={project.id}
          >
            <TableRow
              className="group actual-project-group project-freeze-row"
              data-project-heading={project.id}
            >
              <TableCell className="actual-project-name">
                <strong>{project.name}</strong>
                <ProjectResponsible project={project} />
                <span>
                  {project.start} — {project.end}
                </span>
              </TableCell>
              {months.map((month) => {
                const text =
                  month >= project.start && month <= project.end
                    ? project.phases[month]?.trim()
                    : "";
                return (
                  <TableCell key={month} className="actual-phase-cell">
                    {text && (
                      <button
                        type="button"
                        className="actual-phase-button"
                        style={phaseStyle(project, month)}
                        title={text}
                        aria-label={
                          project.name + " / " + month + " aşaması: " + text
                        }
                        onClick={() => onPhaseDetail({ project, month })}
                      >
                        {text}
                      </button>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
            {people.length > 0 &&
              group.inners.map((index) => {
                const resource = people[index];
                return (
                  <React.Fragment key={project.id + "|" + resource.id}>
                    <TableRow>
                      <TableCell className="rowname">
                        <button
                          type="button"
                          className="person-calendar-trigger"
                          aria-label={
                            resource.name + " izin ve eğitim takvimini aç"
                          }
                          title={resource.name + " · izin ve eğitim takvimi"}
                          onClick={() => {
                            onOpenPersonalCalendar(resource);
                          }}
                        >
                          <CalendarDays size={15} />
                        </button>
                        <span className="indent">↳</span>
                        {resource.name}
                      </TableCell>
                      {months.map((month) => {
                        const key =
                          resource.id + "|" + project.id + "|" + month;
                        const amount = amountFor(resource, project, month);
                        const selectable =
                          month <= currentMonth &&
                          eligible.has(resource.id + "|" + month) &&
                          month >= project.start &&
                          month <= project.end;
                        return (
                          <TableCell
                            key={month}
                            data-actual-context-cell={
                              selectable ? "true" : undefined
                            }
                            className={
                              [
                                amount > 0 ? "has-entry" : "",
                                selectedCell?.key === key
                                  ? "actual-context-selected"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ") || undefined
                            }
                            onClick={() => {
                              if (selectable)
                                selectHoursContext(resource.id, month, key);
                            }}
                            onFocusCapture={() => {
                              if (selectable)
                                selectHoursContext(resource.id, month, key);
                            }}
                          >
                            <Amount
                              value={amount}
                              month={month}
                              unit={unit}
                              workedHours={effectiveHours(resource.id, month)}
                              savedPercent={data.actualPercentEntries?.[key]}
                              otherAllocated={
                                (personMonthTotals[resource.id + "|" + month] ||
                                  0) - amount
                              }
                              fullyAllocated={
                                (personMonthTotals[resource.id + "|" + month] ||
                                  0) >=
                                actualMonths.get(resource.id, month)
                                  .capacityFte -
                                  ACTUAL_FTE_TOLERANCE
                              }
                              disabled={!selectable}
                              onLimitExceeded={(input) =>
                                openLimit("allocation", input)
                              }
                              onDeselect={() => clearSelection()}
                              label={
                                resource.name +
                                " / " +
                                project.name +
                                " / " +
                                month
                              }
                              onSave={(amount) =>
                                save(resource, project, month, amount)
                              }
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    <TableRow className="actual-person-total">
                      <TableCell
                        className="rowname"
                        title={resource.name + " · projeler ve eğitim toplamı"}
                      >
                        <span className="indent">↳</span>Dağıtılan Kaynak %'si
                      </TableCell>
                      {months.map((month) => {
                        const allocated =
                          personMonthTotals[resource.id + "|" + month] || 0;
                        const monthlyCapacity = actualMonths.get(
                          resource.id,
                          month,
                        ).capacityFte;
                        const percent =
                          monthlyCapacity > 0
                            ? (allocated / monthlyCapacity) * 100
                            : 0;
                        const visible = eligible.has(resource.id + "|" + month);
                        const key = resource.id + "|total|" + month;
                        return (
                          <TableCell
                            key={month}
                            data-actual-context-cell={
                              visible ? "true" : undefined
                            }
                            className={
                              [
                                visible && percent >= 100 - 1e-8
                                  ? "actual-total-full"
                                  : "",
                                selectedCell?.key === key
                                  ? "actual-context-selected"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ") || undefined
                            }
                            onClick={() => {
                              if (visible)
                                selectHoursContext(resource.id, month, key);
                            }}
                            title={
                              resource.name +
                              " · " +
                              month +
                              " · projeler ve " +
                              numberFormat.format(
                                calendarTotals(resource.id, month)
                                  .trainingHours,
                              ) +
                              " saat eğitim"
                            }
                          >
                            {visible ? "%" + numberFormat.format(percent) : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </React.Fragment>
                );
              })}
          </TableBody>
        );
      })}
    </Table>
  );
}
