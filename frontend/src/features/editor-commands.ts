import type {
  Change,
  ChangeKind,
  ChangeValues,
} from "../../../shared/commands.ts";
import {
  isWorkingStatus,
  withVersion,
  type Data,
  type Milestone,
} from "../../../shared/model.ts";
import {
  assertMilestoneDateRanges,
  cleanMilestoneRanges,
  milestoneRanges,
  withMilestoneRanges,
  withoutCriticalTopics,
} from "../../../shared/milestone-ranges.ts";
import {
  resourceVersionForEdit,
  resourceVersionForSave,
} from "../../../shared/resource-version-edit.ts";
import type { PortalEditor } from "./editor-state.ts";

type EditorContext = { start: string; resourceIds: readonly string[] };

function command<K extends ChangeKind>(
  data: Data,
  kind: K,
  id: string,
  value: ChangeValues[K],
): Change<K> {
  return { kind, id, value, revision: data.revisions[kind + ":" + id] || 0 };
}

function milestoneChanges(
  data: Data,
  editor: Extract<PortalEditor, { kind: "milestone" }>,
): Change[] {
  const changes: Change[] = [];

  const project = data.projects.find((p) => p.id === editor.projectId);
  if (!project) throw Error("Proje bulunamadı.");
  const draft: Milestone = {
    ...editor.value,
    name: String(editor.value.name).trim(),
    barText: String(editor.value.barText || "").trim(),
  };
  if (!draft.name) throw Error("Kritik konu adı girin.");
  if (draft.name.length > 200)
    throw Error("Kritik konu adı 200 karakteri geçemez.");
  let milestone: Milestone;
  if (editor.draftEmpty) milestone = withoutCriticalTopics(draft);
  else {
    const ranges = milestoneRanges(draft).sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
    );
    assertMilestoneDateRanges(project, ranges);
    milestone = withMilestoneRanges(draft, cleanMilestoneRanges(ranges));
  }
  const milestones = [
    ...(project.milestones || []).filter((m) => m.id !== milestone.id),
    milestone,
  ].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  );
  changes.push(
    command(data, "project", project.id, { ...project, milestones }),
  );

  return changes;
}

function projectChanges(
  data: Data,
  editor: Extract<PortalEditor, { kind: "project" | "projectPhase" }>,
): Change[] {
  const changes: Change[] = [];

  if (
    editor.kind === "projectPhase" &&
    (editor.phaseMonth < editor.value.start ||
      editor.phaseMonth > editor.value.end)
  )
    throw Error("Aşama ayı proje dönemi içinde olmalı.");
  changes.push(command(data, "project", editor.value.id, editor.value));

  return changes;
}

function resourceChanges(
  data: Data,
  editor: Extract<PortalEditor, { kind: "resource" }>,
  start: string,
): Change[] {
  const changes: Change[] = [];

  const { resource: resourceForSave, version: v } = resourceVersionForSave(
    editor.value,
    editor.version,
    editor.isNew,
    start,
  );
  if (
    (isWorkingStatus(v.status) || (v.included && v.status === "Aktif İlan")) &&
    !v.start
  )
    throw Error("Bu statü için İşbaşı Tarihi girin.");
  if (v.status === "İşten Ayrıldı" && (!v.start || !v.end))
    throw Error(
      "İşten Ayrıldı için işbaşı ve işten ayrılış tarihlerini girin.",
    );
  if (v.start && v.end && v.end < v.start)
    throw Error("İşten Ayrılış Tarihi, İşbaşı Tarihi’nden önce olamaz.");
  if (!v.lead || !v.team) throw Error("Liderlik ve takım seçin.");
  const t = data.teams.find((t) => t.id === v.team);
  if (!t)
    throw Error("Seçilen takım bulunamadı. Verileri yenileyip tekrar deneyin.");
  if (t.lead && t.lead !== v.lead)
    throw Error("Seçilen takım bu liderliğe bağlı değil.");
  if (!t.lead)
    changes.push(command(data, "team", t.id, { ...t, lead: v.lead }));
  changes.push(
    command(data, "resource", editor.value.id, withVersion(resourceForSave, v)),
  );

  return changes;
}

function bulkResourceChanges(
  data: Data,
  editor: Extract<PortalEditor, { kind: "bulkResources" }>,
  resourceIds: readonly string[],
): Change[] {
  const changes: Change[] = [];

  if (!resourceIds.length) throw Error("En az bir kayıt seçin.");
  if (!editor.team && !editor.status && editor.included === "keep")
    throw Error("Değiştirilecek en az bir alan seçin.");
  const t = editor.team ? data.teams.find((t) => t.id === editor.team) : null;
  if (editor.team && !t)
    throw Error("Seçilen takım bulunamadı. Verileri yenileyip tekrar deneyin.");
  const leader = t ? t.lead || editor.lead : "";
  if (t && !leader) throw Error("Bu takım için liderlik seçin.");
  if (t && !t.lead)
    changes.push(command(data, "team", t.id, { ...t, lead: leader }));
  for (const id of new Set(resourceIds)) {
    const r = data.resources.find((x) => x.id === id);
    if (!r)
      throw Error(
        "Seçilen kaynak bulunamadı. Verileri yenileyip tekrar deneyin.",
      );
    const old = resourceVersionForEdit(r, editor.effective);
    const v = {
      ...old,
      ...(t ? { team: t.id, lead: leader } : {}),
      ...(editor.status ? { status: editor.status } : {}),
      ...(editor.included !== "keep"
        ? { included: editor.included === "yes" }
        : {}),
    };
    if (editor.status && isWorkingStatus(v.status) && !v.start)
      throw Error(
        r.name + ": İşbaşı Tarihi girilmeden çalışan statüsüne geçirilemez.",
      );
    if (editor.status === "İşten Ayrıldı" && (!v.start || !v.end))
      throw Error(
        r.name +
          ": İşten Ayrıldı statüsü için iki tarihi de bireysel düzenlemede girin.",
      );
    changes.push(command(data, "resource", id, withVersion(r, v)));
  }

  return changes;
}

/** Prepare a complete, revision-aware batch without mutating data or performing I/O.
 * Server authorization and validation remain authoritative when the batch is saved.
 */
export function prepareEditorChanges(
  data: Data,
  editor: PortalEditor,
  context: EditorContext,
): Change[] {
  switch (editor.kind) {
    case "milestone":
      return milestoneChanges(data, editor);
    case "project":
    case "projectPhase":
      return projectChanges(data, editor);
    case "resource":
      return resourceChanges(data, editor, context.start);
    case "bulkResources":
      return bulkResourceChanges(data, editor, context.resourceIds);
  }
}
