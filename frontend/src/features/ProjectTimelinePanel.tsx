import { useMemo, type MouseEvent } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TimelineMonthHead,
  TimelineYearRow,
  yearBandClass,
} from "../components/TimelineHeaders";
import Pager from "../Pager";
import ProjectTimelineRows from "../ProjectTimelineRows";
import type { Project, Milestone } from "../model";
import { projectTimelinePeriods } from "../timeline-periods";

import type { usePhaseGrid } from "./usePhaseGrid";
type DragMode = "move" | "start" | "end";
export type ProjectTimelineActions = {
  onProjectInfo: (project: Project) => void;
  onPhaseClick: (project: Project, month: string) => void;
  onPhaseContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    project: Project,
    month: string,
  ) => void;
  onAddMilestone: (project: Project) => void;
  onEditMilestone: (project: Project, milestone: Milestone) => void;
  onDeleteMilestone: (project: Project, milestone: Milestone) => Promise<void>;
  onReorderMilestone: (
    project: Project,
    sourceId: string,
    targetId: string,
    after: boolean,
  ) => Promise<void>;
  onMilestoneContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    project: Project,
    milestone: Milestone,
    rangeIndex: number,
  ) => void;
  onChangeMilestoneRange: (
    project: Project,
    milestone: Milestone,
    rangeIndex: number,
    mode: DragMode,
    days: number,
  ) => Promise<void>;
  onChangeMilestoneNote: (
    project: Project,
    milestone: Milestone,
    rangeIndex: number,
    noteIndex: number,
    mode: DragMode,
    days: number,
  ) => Promise<void>;
};
type Props = {
  projects: Project[];
  months: string[];
  weekly: boolean;
  todayDate: string;
  labelWidth: number;
  monthWidth: number;
  density: "detail" | "compact" | "overview";
  expandAllDetails: boolean;
  isAdmin: boolean;
  saving: boolean;
  page: number;
  onPageChange: (page: number) => void;
  actions: ProjectTimelineActions;
  selection: ReturnType<typeof usePhaseGrid>;
};

export default function ProjectTimelinePanel({
  projects,
  months,
  weekly,
  todayDate,
  labelWidth,
  monthWidth,
  density,
  expandAllDetails,
  isAdmin,
  saving,
  page,
  onPageChange,
  actions,
  selection,
}: Props) {
  const projectPeriods = useMemo(
    () => projectTimelinePeriods(months, weekly),
    [months, weekly],
  );
  const projectYearBands = useMemo(
    () => [...new Set(projectPeriods.map((period) => period.year))],
    [projectPeriods],
  );
  return (
    <section className="panel">
      <Pager
        total={projects.length}
        page={page}
        size={20}
        onChange={onPageChange}
        label="Proje"
      />
      <div className="phase-selection-hint">
        Sürükleyerek ayları seçin · Sağ tık: metin / renk kopyala ve yapıştır ·
        Çift tık veya Enter: düzenle
        {weekly && " · Aşama bilgileri ay bazında seçilir"}
        {!!selection.cells.length && (
          <strong>{selection.cells.length} hücre seçili</strong>
        )}
      </div>
      <Table
        ref={selection.tableRef}
        todayDate={todayDate}
        todayMonthsKey={projectPeriods.map((period) => period.key).join("|")}
        className={
          "matrix projectmatrix planning-grid" +
          (weekly ? " weekly-projectmatrix" : "")
        }
        style={{
          width: labelWidth + projectPeriods.length * monthWidth,
          minWidth: "100%",
        }}
      >
        <colgroup>
          <col style={{ width: labelWidth }} />
          {projectPeriods.map((period) => (
            <col key={period.key} style={{ width: monthWidth }} />
          ))}
        </colgroup>
        <TableHeader>
          <TimelineYearRow
            years={projectPeriods.map((period) => period.year)}
          />
          <TableRow>
            <TableHead>Proje</TableHead>
            {projectPeriods.map((period) =>
              period.kind === "month" ? (
                <TimelineMonthHead
                  key={period.key}
                  month={period.month}
                  years={projectYearBands}
                />
              ) : (
                <TableHead
                  key={period.key}
                  data-date-start={period.start}
                  data-date-end={period.end}
                  className={
                    "monthhead weekhead " +
                    yearBandClass(projectYearBands.indexOf(period.year))
                  }
                  title={period.fullLabel}
                >
                  <span className="week-number">W{period.weekNumber}</span>
                  <span className="week-range">{period.label}</span>
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.slice(page * 20, (page + 1) * 20).map((p) => (
            <ProjectTimelineRows
              key={p.id}
              project={p}
              phaseSelection={selection}
              periods={projectPeriods}
              density={density}
              expandAllDetails={expandAllDetails}
              isAdmin={!!isAdmin}
              saving={saving}
              onProjectInfo={() => actions.onProjectInfo(p)}
              onPhaseClick={(m) => actions.onPhaseClick(p, m)}
              onPhaseContextMenu={(event, m) =>
                actions.onPhaseContextMenu(event, p, m)
              }
              onAddMilestone={() => actions.onAddMilestone(p)}
              onEditMilestone={(milestone) =>
                actions.onEditMilestone(p, milestone)
              }
              onDeleteMilestone={(milestone) =>
                void actions.onDeleteMilestone(p, milestone)
              }
              onReorderMilestone={(sourceId, targetId, after) =>
                void actions.onReorderMilestone(p, sourceId, targetId, after)
              }
              onMilestoneContextMenu={(event, milestone, rangeIndex) =>
                actions.onMilestoneContextMenu(event, p, milestone, rangeIndex)
              }
              onChangeMilestoneRange={(milestone, rangeIndex, mode, days) =>
                actions.onChangeMilestoneRange(
                  p,
                  milestone,
                  rangeIndex,
                  mode,
                  days,
                )
              }
              onChangeMilestoneNote={(
                milestone,
                rangeIndex,
                noteIndex,
                mode,
                days,
              ) =>
                actions.onChangeMilestoneNote(
                  p,
                  milestone,
                  rangeIndex,
                  noteIndex,
                  mode,
                  days,
                )
              }
            />
          ))}
        </TableBody>
      </Table>
      {!projects.length && (
        <p className="emptymsg">Seçili filtrelere uygun proje bulunamadı.</p>
      )}
    </section>
  );
}
