import type { Change } from "../../../shared/commands.ts";
import {
  phaseColor,
  phasePalette,
  type Data,
  type Project,
} from "../../../shared/model.ts";
import {
  milestoneRanges,
  withMilestoneRanges,
} from "../../../shared/milestone-ranges.ts";
import { validPlanningMonth } from "../../../shared/planning-dates.ts";
export type PhaseTarget = { projectId: string; month: string };
export type MilestoneTarget = {
  projectId: string;
  milestoneId: string;
  rangeIndex: number;
};
export type PhaseClipboard = { text: string; color: string };
export type PhasePaste =
  | { kind: "text"; text: string }
  | { kind: "color"; color: string }
  | ({ kind: "bundle" } & PhaseClipboard);
function projectFor(data: Data, id: string) {
  const project = data.projects.find((project) => project.id === id);
  if (!project)
    throw Error("Proje bulunamadı. Verileri yenileyip tekrar deneyin.");
  return project;
}
function assertColor(color: string) {
  if (!phasePalette.some((value) => value.id === color))
    throw Error("Geçersiz renk seçimi.");
}
function projectChange(data: Data, project: Project): Change<"project"> {
  return {
    kind: "project",
    id: project.id,
    value: project,
    revision: data.revisions["project:" + project.id] || 0,
  };
}
export function phaseClipboard(
  project: Project,
  month: string,
): PhaseClipboard {
  return {
    text: project.phases[month] || "",
    color: phaseColor(project, month).id,
  };
}
export function preparePhasePaste(
  data: Data,
  target: PhaseTarget,
  content: PhasePaste,
): Change<"project"> {
  const project = projectFor(data, target.projectId),
    month = target.month;
  if (
    !validPlanningMonth(month) ||
    month < project.start ||
    month > project.end
  )
    throw Error("Proje dönemi dışına aşama yapıştırılamaz.");
  if (content.kind !== "text") assertColor(content.color);
  return projectChange(data, {
    ...project,
    ...(content.kind !== "color"
      ? { phases: { ...project.phases, [month]: content.text } }
      : {}),
    ...(content.kind !== "text"
      ? { phaseColors: { ...project.phaseColors, [month]: content.color } }
      : {}),
  });
}
function milestoneFor(data: Data, target: MilestoneTarget) {
  const project = projectFor(data, target.projectId);
  const milestone = project.milestones?.find(
    (value) => value.id === target.milestoneId,
  );
  if (!milestone)
    throw Error("Kritik konu bulunamadı. Verileri yenileyip tekrar deneyin.");
  const ranges = milestoneRanges(milestone);
  if (!Number.isInteger(target.rangeIndex) || !ranges[target.rangeIndex])
    throw Error(
      "Kritik konu tarih aralığı bulunamadı. Verileri yenileyip tekrar deneyin.",
    );
  return { project, milestone, ranges };
}
export function milestoneClipboardColor(data: Data, target: MilestoneTarget) {
  return milestoneFor(data, target).ranges[target.rangeIndex].color || "red";
}
export function prepareMilestoneColorPaste(
  data: Data,
  target: MilestoneTarget,
  color: string,
): Change<"project"> {
  assertColor(color);
  const { project, milestone, ranges } = milestoneFor(data, target);
  const changed = withMilestoneRanges(
    milestone,
    ranges.map((range, index) =>
      index === target.rangeIndex ? { ...range, color } : range,
    ),
  );
  return projectChange(data, {
    ...project,
    milestones: project.milestones?.map((value) =>
      value.id === milestone.id ? changed : value,
    ),
  });
}
