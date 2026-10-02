import { ownValue } from "../../../shared/records";
import {
  Fragment,
  useMemo,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { ChevronDown, Layers3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Data, Team, Project } from "../model";
import { phaseStyle } from "../model";
import { capacityStatus } from "../capacity-status";
import type { Metric } from "../metrics";
import { fmt, monthLabel } from "../format";
import Cell from "../components/AllocationCell";
import MemberBadge from "../components/MemberBadge";
import {
  TimelineMonthHead,
  TimelineYearRow,
} from "../components/TimelineHeaders";
import ProjectResponsible from "../ProjectResponsible";
import Pager from "../Pager";
import type { usePlannedGrid } from "./usePlannedGrid";
import type { ProjectTimelineActions } from "./ProjectTimelinePanel";
type PlanningGrid = Pick<
  ReturnType<typeof usePlannedGrid>,
  | "planCellWritable"
  | "startPlanDrag"
  | "openPlanMenu"
  | "firstSelectedPlanCell"
  | "fillSelectedPlanCells"
  | "completePlanEntry"
>;
type Props = {
  data: Data;
  teams: Team[];
  projects: Project[];
  months: string[];
  view: string;
  density: "detail" | "compact" | "overview";
  todayDate: string;
  currentMonth: string;
  labelWidth: number;
  monthWidth: number;
  page: number;
  pageSize: number;
  groups: { outer: number; inners: number[] }[];
  onPageChange: (page: number) => void;
  showCapacity: boolean;
  onCapacityChange: (open: boolean) => void;
  capacityFilters: { label: string; values: string[]; active: boolean }[];
  metric: (ids: string[], month: string) => Metric;
  projectIds: string[];
  projectTotals: Record<string, number>;
  actualTotals: Record<string, number>;
  showAllActual: boolean;
  expandedActualTeams: string[];
  onExpandedTeamsChange: Dispatch<SetStateAction<string[]>>;
  currentTeamMembers: Record<string, string[]>;
  cells: string[];
  grid: PlanningGrid;
  planTableRef: RefObject<HTMLTableElement | null>;
  capacityTableRef: RefObject<HTMLTableElement | null>;
  onSaveAllocation: (id: string, value: number) => Promise<void>;
  onPhaseClick: ProjectTimelineActions["onPhaseClick"];
  onPhaseContextMenu: ProjectTimelineActions["onPhaseContextMenu"];
};
export default function PlannedAllocationPanel({
  data,
  teams,
  projects,
  months,
  view,
  density,
  todayDate,
  currentMonth,
  labelWidth,
  monthWidth,
  page,
  pageSize,
  groups,
  onPageChange,
  showCapacity,
  onCapacityChange,
  capacityFilters,
  metric,
  projectIds,
  projectTotals,
  actualTotals,
  showAllActual,
  expandedActualTeams,
  onExpandedTeamsChange,
  currentTeamMembers,
  cells,
  grid,
  planTableRef,
  capacityTableRef,
  onSaveAllocation,
  onPhaseClick,
  onPhaseContextMenu,
}: Props) {
  const {
    planCellWritable,
    startPlanDrag,
    openPlanMenu,
    firstSelectedPlanCell,
    fillSelectedPlanCells,
    completePlanEntry,
  } = grid;
  const cellSet = useMemo(() => new Set(cells), [cells]);
  function summary(ts: Team[], mths = months, selectedReport = false) {
    const teamIds = ts.map((t) => t.id);
    const rows: [number, string][] = [
      [0, "Aktif Kaynak"],
      [2, selectedReport ? "Dağıtılan Kaynak" : "Tüm Projelere Tahsis"],
      [3, "Kalan Kaynak"],
    ];
    return rows.map(([kind, title]) => (
      <TableRow key={title} className={"summary s" + kind}>
        <TableCell>{title}</TableCell>
        {mths.map((m) => {
          const c = metric(teamIds, m);
          const allocated =
            selectedReport && projectIds.length
              ? projects.reduce(
                  (total, p) => total + (projectTotals[p.id + "|" + m] || 0),
                  0,
                )
              : c.total;
          const value =
            kind === 0
              ? c.current
              : kind === 2
                ? allocated
                : c.current - allocated;
          return (
            <TableCell
              key={m}
              className={
                kind >= 2 ? capacityStatus(c.current, allocated).className : ""
              }
              title={
                monthLabel(m) +
                " · " +
                title +
                ": " +
                fmt(value) +
                (kind >= 2
                  ? " · " + capacityStatus(c.current, allocated).label
                  : "")
              }
            >
              {fmt(value)}
            </TableCell>
          );
        })}
      </TableRow>
    ));
  }
  function phaseText(p: Project, m: string) {
    return m < p.start || m > p.end
      ? "Proje dönemi dışında"
      : p.phases[m] || "Çalışma bilgisi girilmemiş";
  }
  function phase(p: Project, m: string) {
    const text = phaseText(p, m);
    return (
      <button
        className="month-work"
        style={phaseStyle(p, m)}
        title={p.name + " / " + monthLabel(m) + "\n" + text}
        aria-label={p.name + " / " + monthLabel(m) + " planlanan çalışma"}
        onContextMenu={(e) => onPhaseContextMenu(e, p, m)}
        onClick={() => onPhaseClick(p, m)}
        disabled={m < p.start || m > p.end}
      >
        <span className="phasepreview">
          {density === "overview" ? (p.phases[m] ? "●" : "·") : text}
        </span>
      </button>
    );
  }
  function monthColumns(first = labelWidth, second = 0, width = monthWidth) {
    return (
      <colgroup>
        <col style={{ width: first }} />
        {!!second && <col style={{ width: second }} />}
        {months.map((m) => (
          <col key={m} style={{ width }} />
        ))}
      </colgroup>
    );
  }
  function yearRow(labelColumns = 1) {
    return (
      <TimelineYearRow
        years={months.map((month) => month.slice(0, 4))}
        labelColumns={labelColumns}
      />
    );
  }
  function monthHead(month: string) {
    return (
      <TimelineMonthHead
        key={month}
        month={month}
        years={[...new Set(months.map((value) => value.slice(0, 4)))]}
      />
    );
  }
  function toggleActual(teamId: string) {
    onExpandedTeamsChange((old) =>
      old.includes(teamId)
        ? old.filter((id) => id !== teamId)
        : [...old, teamId],
    );
  }
  function actualVisible(teamId: string) {
    return showAllActual
      ? !expandedActualTeams.includes(teamId)
      : expandedActualTeams.includes(teamId);
  }
  function actualRow(t: Team, p: Project) {
    return (
      <TableRow key={"actual-" + t.id + "-" + p.id} className="actual-row">
        <TableCell className="rowname">Gerçekleşen Kaynak Dağılımı</TableCell>
        {months.map((m) => {
          const k = t.id + "|" + p.id + "|" + m,
            actual = actualTotals[k] || 0,
            planned = data?.allocations[k] || 0;
          return (
            <TableCell
              key={m}
              className={
                [
                  actual > 0 ? "has-entry" : "",
                  actual > planned + 0.000001 ? "actual-exceeds-plan" : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              title={
                monthLabel(m) +
                " gerçekleşen: " +
                fmt(actual) +
                " / öngörülen: " +
                fmt(planned)
              }
            >
              {fmt(actual)}
            </TableCell>
          );
        })}
      </TableRow>
    );
  }
  function memberBadge(label: string, members: string[]) {
    return (
      <MemberBadge
        label={label}
        members={members}
        currentMonth={currentMonth}
      />
    );
  }
  function teamMemberBadge(t: Team) {
    return memberBadge(t.name, ownValue(currentTeamMembers, t.id) || []);
  }
  function allocationRow(t: Team, p: Project) {
    return (
      <Fragment key={t.id + p.id}>
        <TableRow>
          <TableCell className="rowname">
            {view === "project" && (
              <button
                className="actual-expand"
                type="button"
                aria-label={
                  t.name +
                  " gerçekleşen dağılımı " +
                  (actualVisible(t.id) ? "gizle" : "göster")
                }
                aria-expanded={actualVisible(t.id)}
                onClick={() => toggleActual(t.id)}
              >
                {actualVisible(t.id) ? "−" : "+"}
              </button>
            )}
            {view === "team" && <span className="indent">↳</span>}
            {view === "team" ? (
              <span className="project-row-label">
                <span>{p.name}</span>
                <ProjectResponsible project={p} />
              </span>
            ) : (
              <span className="team-row-block">
                <span className="team-row-title">
                  <span>{t.name}</span>
                  {teamMemberBadge(t)}
                </span>
                <span className="team-manager">
                  Yönetici: {t.managerName || "Atanmamış"}
                </span>
              </span>
            )}
          </TableCell>
          {months.map((m) => {
            const k = t.id + "|" + p.id + "|" + m,
              disabled = m < p.start || m > p.end,
              editable = planCellWritable(k);
            return (
              <TableCell
                key={m}
                data-plan-cell={k}
                onPointerDown={(e) => startPlanDrag(e, k)}
                onContextMenu={(e) => openPlanMenu(e, k)}
                className={
                  (view === "team" ? "allocation-with-work " : "") +
                  ((data?.allocations[k] || 0) > 0 ? "has-entry " : "") +
                  (cellSet.has(k) ? "selectedcell" : "")
                }
              >
                {view === "team" && phase(p, m)}
                <Cell
                  value={data?.allocations[k] || 0}
                  label={t.name + " / " + p.name + " / " + monthLabel(m)}
                  disabled={disabled || !editable}
                  save={(v) => onSaveAllocation(k, v)}
                  onCommit={completePlanEntry}
                  onFillSelection={
                    cells.length > 1 && firstSelectedPlanCell === k
                      ? fillSelectedPlanCells
                      : undefined
                  }
                />
              </TableCell>
            );
          })}
        </TableRow>
        {actualVisible(t.id) && actualRow(t, p)}
      </Fragment>
    );
  }

  return (
    <section className="panel">
      {view === "project" && (
        <details
          className="capacitystrip"
          open={showCapacity}
          onToggle={(e) => onCapacityChange(e.currentTarget.open)}
        >
          <summary>
            <span className="capacitystrip-icon" aria-hidden="true">
              <Layers3 size={18} />
            </span>
            <span className="capacitystrip-copy">
              <strong>Filtrelenen Takımlar Özet Kaynak Raporu</strong>
              <span
                className="capacity-filter-list"
                aria-label="Özet kaynak raporunda uygulanan filtreler"
              >
                {capacityFilters.map(({ label, values, active }) => (
                  <span
                    key={label}
                    className={
                      "capacity-filter-chip" + (active ? " is-active" : "")
                    }
                    title={
                      label +
                      ": " +
                      (values.length ? values.join(", ") : "Tümü")
                    }
                  >
                    <span>{label}</span>
                    <strong>
                      {values.length ? values.join(", ") : "Tümü"}
                    </strong>
                  </span>
                ))}
              </span>
            </span>
            <span className="capacitystrip-action" aria-hidden="true">
              {showCapacity ? "Detayı Gizle" : "Detayı Göster"}
              <ChevronDown size={17} />
            </span>
          </summary>
          {showCapacity && (
            <Table
              ref={capacityTableRef}
              todayDate={todayDate}
              todayMonthsKey={months.join("|")}
              className="matrix planning-grid allocation-grid"
              style={{
                width: labelWidth + months.length * monthWidth,
                minWidth: "100%",
              }}
            >
              {monthColumns(labelWidth, 0, monthWidth)}
              <TableHeader>
                {yearRow()}
                <TableRow>
                  <TableHead>Kaynak</TableHead>
                  {months.map(monthHead)}
                </TableRow>
              </TableHeader>
              <TableBody>{summary(teams, months, true)}</TableBody>
            </Table>
          )}
        </details>
      )}
      <Pager
        total={teams.length * projects.length}
        page={page}
        size={pageSize}
        onChange={onPageChange}
        label="Takım / proje satırı"
      />
      <Table
        ref={planTableRef}
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
        {monthColumns(labelWidth, 0, monthWidth)}
        <TableHeader>
          {yearRow()}
          <TableRow>
            <TableHead>
              {view === "team" ? "Takım / Proje" : "Proje / Takım"}
            </TableHead>
            {months.map(monthHead)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {view === "team"
            ? groups.map((g) => {
                const t = teams[g.outer];
                return (
                  <Fragment key={t.id}>
                    <TableRow className="group">
                      <TableCell colSpan={months.length + 1}>
                        <div className="team-group-label">
                          <button
                            className="actual-expand"
                            type="button"
                            aria-label={
                              t.name +
                              " gerçekleşen dağılımı " +
                              (actualVisible(t.id) ? "gizle" : "göster")
                            }
                            aria-expanded={actualVisible(t.id)}
                            onClick={() => toggleActual(t.id)}
                          >
                            {actualVisible(t.id) ? "−" : "+"}
                          </button>
                          <div>
                            <div className="team-heading">
                              <strong
                                title={t.lead || "Liderlik eşleştirilmemiş"}
                              >
                                {t.name}
                              </strong>
                              {teamMemberBadge(t)}
                            </div>
                            <span>
                              Yönetici: {t.managerName || "Atanmamış"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    {g.inners.map((i) => allocationRow(t, projects[i]))}
                    {summary([t])}
                  </Fragment>
                );
              })
            : groups.map((g) => {
                const p = projects[g.outer];
                return (
                  <Fragment key={p.id}>
                    <TableRow className="group project-phase-group">
                      <TableCell className="project-group-name">
                        <strong>{p.name}</strong>
                        <ProjectResponsible project={p} />
                        <span>
                          {p.start} — {p.end}
                        </span>
                      </TableCell>
                      {months.map((m) => (
                        <TableCell key={m}>{phase(p, m)}</TableCell>
                      ))}
                    </TableRow>
                    {g.inners.map((i) => allocationRow(teams[i], p))}
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
                  </Fragment>
                );
              })}
        </TableBody>
      </Table>
      {(!teams.length || !projects.length) && (
        <p className="emptymsg">Bu filtrelere uygun takım veya proje yok.</p>
      )}
      <footer className="tablefoot">
        <span>Birim: aylık kişi eşdeğeri · Ondalık giriş: 0,5</span>
        <span>
          Fareyle sürükleyerek aralık seçin; sağ tıkla kopyalayıp yapıştırın.
          Proje dönemi dışına giriş yapılamaz.
        </span>
      </footer>
    </section>
  );
}
