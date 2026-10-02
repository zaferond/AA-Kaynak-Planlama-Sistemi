import type { MouseEvent } from "react";
import type { Milestone, Project } from "../model";
import type { TimelinePeriod } from "../timeline-periods";
import type { milestoneRanges } from "../milestone-ranges";
import type { milestoneBarsForPeriods } from "../milestone-bars";
import type { weeklyNoteLayout } from "../weekly-note-bars";
import type { usePhaseGrid } from "./usePhaseGrid";

export type ProjectTimelineRowProps = {
  phaseSelection: ReturnType<typeof usePhaseGrid>;
  project: Project;
  periods: TimelinePeriod[];
  density: "detail" | "compact" | "overview";
  expandAllDetails: boolean;
  isAdmin: boolean;
  saving: boolean;
  onProjectInfo: () => void;
  onPhaseClick: (month: string) => void;
  onPhaseContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    month: string,
  ) => void;
  onAddMilestone: () => void;
  onEditMilestone: (milestone: Milestone) => void;
  onDeleteMilestone: (milestone: Milestone) => void;
  onReorderMilestone: (
    sourceId: string,
    targetId: string,
    after: boolean,
  ) => void;
  onMilestoneContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    milestone: Milestone,
    rangeIndex: number,
  ) => void;
  onChangeMilestoneRange: (
    milestone: Milestone,
    rangeIndex: number,
    mode: "move" | "start" | "end",
    days: number,
  ) => Promise<void>;
  onChangeMilestoneNote: (
    milestone: Milestone,
    rangeIndex: number,
    noteIndex: number,
    mode: "move" | "start" | "end",
    days: number,
  ) => Promise<void>;
};

export type MilestoneTrackProps = Pick<
  ProjectTimelineRowProps,
  | "isAdmin"
  | "saving"
  | "onEditMilestone"
  | "onMilestoneContextMenu"
  | "onChangeMilestoneRange"
  | "onChangeMilestoneNote"
> & {
  project: Project;
  milestone: Milestone;
  ranges: ReturnType<typeof milestoneRanges>;
  bars: ReturnType<typeof milestoneBarsForPeriods>;
  periods: TimelinePeriod[];
  weeklyLayout: ReturnType<typeof weeklyNoteLayout> | null;
};
