import type { Change } from "../../../shared/commands.ts";
import type { Data } from "../../../shared/model.ts";
import {
  changeMilestoneNoteDates,
  milestoneRanges,
  resizeMilestoneRange,
  shiftMilestoneRange,
  withMilestoneRanges,
} from "../../../shared/milestone-ranges.ts";

type DateAdjustment = {
  rangeIndex: number;
  mode: "move" | "start" | "end";
  days: number;
} & ({ target: "range" } | { target: "note"; noteIndex: number });

/** Use the latest project snapshot and revision for both monthly and weekly edits. */
export function prepareTimelineChange(
  data: Data,
  projectId: string,
  milestoneId: string,
  adjustment: DateAdjustment,
): Change<"project"> {
  const project = data.projects.find((item) => item.id === projectId);
  const milestone = project?.milestones?.find(
    (item) => item.id === milestoneId,
  );
  if (!project || !milestone)
    throw Error("Kritik konu bulunamadı. Verileri yenileyip tekrar deneyin.");
  const { rangeIndex, mode, days } = adjustment;
  const changed =
    adjustment.target === "note"
      ? changeMilestoneNoteDates(
          project,
          milestone,
          rangeIndex,
          adjustment.noteIndex,
          mode,
          days,
        )
      : mode === "move"
        ? shiftMilestoneRange(project, milestone, rangeIndex, days)
        : resizeMilestoneRange(project, milestone, rangeIndex, mode, days);
  const ordered = withMilestoneRanges(
    changed,
    milestoneRanges(changed).sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
    ),
  );
  return {
    kind: "project",
    id: project.id,
    revision: data.revisions["project:" + project.id] || 0,
    value: {
      ...project,
      milestones: project.milestones?.map((item) =>
        item.id === milestone.id ? ordered : item,
      ),
    },
  };
}
