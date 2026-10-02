import type { Change } from "../../../shared/commands.ts";
import {
  phaseColor,
  phasePalette,
  monthsFrom,
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
export type PhaseCopyKind = "text" | "color" | "bundle";
export type PhaseRowsClipboard = {
  rows: { name: string; cells: { month: string; value: PhaseClipboard }[] }[];
};
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
export function copyPhaseRows(projects: Project[]): PhaseRowsClipboard {
  if (!projects.length) throw Error("Önce proje satırlarını seçin.");
  return {
    rows: projects.map((project) => {
      if (
        !validPlanningMonth(project.start) ||
        !validPlanningMonth(project.end) ||
        project.start > project.end
      )
        throw Error("Geçersiz proje dönemi.");
      const [startYear, startMonth] = project.start.split("-").map(Number);
      const [endYear, endMonth] = project.end.split("-").map(Number);
      const months = monthsFrom(
        project.start,
        (endYear - startYear) * 12 + endMonth - startMonth + 1,
      );
      return {
        name: project.name,
        cells: months.map((month) => ({
          month,
          value: phaseClipboard(project, month),
        })),
      };
    }),
  };
}
// One source row may fill several projects; several sources require an equal
// target count. Calendar columns keep their dates, independent of weekly zoom.
export function preparePhaseRowsPaste(
  data: Data,
  targetIds: string[],
  clipboard: PhaseRowsClipboard,
  kind: PhaseCopyKind,
): Change<"project">[] {
  const ids = [...new Set(targetIds)];
  if (!ids.length || !clipboard.rows.length)
    throw Error("Önce hedef proje satırlarını seçin.");
  if (clipboard.rows.length !== 1 && clipboard.rows.length !== ids.length)
    throw Error(
      "Birden fazla satır yapıştırırken kaynak ve hedef proje sayıları eşit olmalıdır.",
    );
  return ids.map((id, index) => {
    const project = projectFor(data, id);
    const source = clipboard.rows[clipboard.rows.length === 1 ? 0 : index];
    const phases = { ...project.phases },
      phaseColors = { ...project.phaseColors };
    for (const { month, value } of source.cells) {
      if (
        !validPlanningMonth(month) ||
        month < project.start ||
        month > project.end
      )
        throw Error(
          project.name +
            ": kopyalanan aylar hedef proje dönemi dışında. Proje tarihlerini kontrol edin.",
        );
      if (kind !== "color") phases[month] = value.text;
      if (kind !== "text") {
        assertColor(value.color);
        phaseColors[month] = value.color;
      }
    }
    return projectChange(data, {
      ...project,
      ...(kind !== "color" ? { phases } : {}),
      ...(kind !== "text" ? { phaseColors } : {}),
    });
  });
}
export function preparePhaseRowsFill(
  data: Data,
  targetIds: string[],
  content: PhasePaste,
): Change<"project">[] {
  return [...new Set(targetIds)].map((id) => {
    const project = projectFor(data, id);
    const clipboard = copyPhaseRows([project]);
    for (const cell of clipboard.rows[0].cells)
      cell.value = {
        text: content.kind === "color" ? cell.value.text : content.text,
        color: content.kind === "text" ? cell.value.color : content.color,
      };
    return preparePhaseRowsPaste(data, [id], clipboard, content.kind)[0];
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
