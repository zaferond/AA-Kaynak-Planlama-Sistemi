import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Data, Project, Milestone } from "../model";
import type { Change } from "../../../shared/commands";
import { monthLabel } from "../format";
import {
  phaseClipboard,
  milestoneClipboardColor,
  preparePhasePaste,
  prepareMilestoneColorPaste,
  type PhaseClipboard,
  type PhaseTarget,
  type MilestoneTarget,
  type PhasePaste,
  copyPhaseRows,
  preparePhaseRowsPaste,
  preparePhaseRowsFill,
  type PhaseRowsClipboard,
  type PhaseCopyKind,
} from "./project-clipboard";
type Position = { x: number; y: number };
type Props = {
  data: Data | null;
  visibleProjects: Project[];
  active: boolean;
  selectionKey: string;
  isAdmin: boolean;
  saving: boolean;
  batch: (changes: Change[]) => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};
function menuPosition(
  event: MouseEvent<HTMLElement>,
  height: number,
): Position {
  const rect = event.currentTarget.getBoundingClientRect();
  const zoom =
    Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  return {
    x:
      Math.max(
        8,
        Math.min(event.clientX || rect.left, window.innerWidth - 220 * zoom),
      ) / zoom,
    y:
      Math.max(
        8,
        Math.min(
          event.clientY || rect.bottom,
          window.innerHeight - height * zoom,
        ),
      ) / zoom,
  };
}
function copySystemText(text: string) {
  if (navigator.clipboard && window.isSecureContext)
    void navigator.clipboard.writeText(text).catch(() => {});
}
export function useProjectMenus({
  data,
  visibleProjects,
  active,
  selectionKey,
  isAdmin,
  saving,
  batch,
  setNotice,
  setError,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const projectTableRef = useRef<HTMLTableElement>(null);
  const rowAnchor = useRef<string | null>(null);
  const pastePending = useRef(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [copiedRows, setCopiedRows] = useState<
    Partial<Record<PhaseCopyKind, PhaseRowsClipboard>>
  >({});
  const [lastRowCopyKind, setLastRowCopyKind] =
    useState<PhaseCopyKind>("bundle");
  const visibleKey = JSON.stringify(
    visibleProjects.map((project) => project.id),
  );
  useEffect(() => {
    setSelectedProjectIds([]);
    rowAnchor.current = null;
    setPhaseMenu(null);
    setMilestoneMenu(null);
  }, [active, selectionKey, visibleKey]);
  function clearProjectSelection() {
    setSelectedProjectIds([]);
    rowAnchor.current = null;
  }
  function toggleProjectRow(id: string, shift = false) {
    if (saving) return;
    const ids = visibleProjects.map((project) => project.id);
    if (!ids.includes(id)) return;
    if (shift && rowAnchor.current && ids.includes(rowAnchor.current)) {
      const start = ids.indexOf(rowAnchor.current),
        end = ids.indexOf(id);
      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      setSelectedProjectIds((previous) => [
        ...new Set([...previous, ...range]),
      ]);
    } else {
      setSelectedProjectIds((previous) =>
        previous.includes(id)
          ? previous.filter((value) => value !== id)
          : [...previous, id],
      );
      rowAnchor.current = id;
    }
  }
  function selectAllProjectRows() {
    if (saving) return;
    setSelectedProjectIds(
      selectedProjectIds.length === visibleProjects.length
        ? []
        : visibleProjects.map((project) => project.id),
    );
  }
  function orderedSelection() {
    return visibleProjects
      .filter((project) => selectedProjectIds.includes(project.id))
      .map((project) => project.id);
  }

  const [phaseMenu, setPhaseMenu] = useState<
    (PhaseTarget & Position & { projectIds: string[] }) | null
  >(null);
  const [milestoneMenu, setMilestoneMenu] = useState<
    (MilestoneTarget & Position) | null
  >(null);
  const [copiedPhase, setCopiedPhase] = useState<string | null>(null);
  const [copiedPhaseColor, setCopiedPhaseColor] = useState<string | null>(null);
  const [copiedPhaseBundle, setCopiedPhaseBundle] =
    useState<PhaseClipboard | null>(null);
  useEffect(() => {
    if (!phaseMenu && !milestoneMenu) return;
    menuRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPhaseMenu(null);
        setMilestoneMenu(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [phaseMenu, milestoneMenu]);
  function openPhaseMenu(
    event: MouseEvent<HTMLButtonElement>,
    project: Project,
    month: string,
  ) {
    event.preventDefault();
    if (month < project.start || month > project.end) return;
    setMilestoneMenu(null);
    const ids = active ? orderedSelection() : [];
    const projectIds = ids.length
      ? ids.includes(project.id)
        ? ids
        : [project.id]
      : [];
    if (projectIds.length) setSelectedProjectIds(projectIds);
    setPhaseMenu({
      projectId: project.id,
      month,
      projectIds,
      ...menuPosition(
        event,
        projectIds.length || Object.values(copiedRows).some(Boolean)
          ? 400
          : 320,
      ),
    });
  }
  function openProjectRowMenu(
    event: MouseEvent<HTMLElement>,
    project: Project,
  ) {
    event.preventDefault();
    const ids = orderedSelection();
    const projectIds = ids.includes(project.id) ? ids : [project.id];
    setSelectedProjectIds(projectIds);
    setMilestoneMenu(null);
    setPhaseMenu({
      projectId: project.id,
      month: project.start,
      projectIds,
      ...menuPosition(event, 400),
    });
  }
  function openMilestoneMenu(
    event: MouseEvent<HTMLButtonElement>,
    project: Project,
    milestone: Milestone,
    rangeIndex: number,
  ) {
    event.preventDefault();
    setPhaseMenu(null);
    setMilestoneMenu({
      projectId: project.id,
      milestoneId: milestone.id,
      rangeIndex,
      ...menuPosition(event, 170),
    });
  }
  function selectedPhase() {
    const project = data?.projects.find(
      (project) => project.id === phaseMenu?.projectId,
    );
    return project && phaseMenu
      ? phaseClipboard(project, phaseMenu.month)
      : null;
  }
  function copyProjectRows(kind: PhaseCopyKind, ids: string[]) {
    if (!data) return;
    try {
      const projects = ids.map((id) =>
        data.projects.find((project) => project.id === id),
      );
      if (projects.some((project) => !project))
        throw Error("Proje bulunamadı. Verileri yenileyin.");
      const copied = copyPhaseRows(projects as Project[]);
      setCopiedRows((previous) => ({ ...previous, [kind]: copied }));
      setLastRowCopyKind(kind);
      if (kind === "text") setCopiedPhase(null);
      else if (kind === "color") setCopiedPhaseColor(null);
      else setCopiedPhaseBundle(null);
      setPhaseMenu(null);
      clearProjectSelection();
      setError("");
      setNotice(
        ids.length +
          " proje satırının tüm ayları kopyalandı. Hedef satırları seçip sağ tık ile yapıştırın.",
      );
      if (kind !== "color")
        copySystemText(
          copied.rows
            .map((row) => row.cells.map((cell) => cell.value.text).join("\t"))
            .join("\n"),
        );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function copyPhase() {
    if (phaseMenu?.projectIds.length) {
      copyProjectRows("text", phaseMenu.projectIds);
      return;
    }
    const content = selectedPhase();
    if (!content?.text) return;
    setCopiedRows((previous) => ({ ...previous, text: undefined }));
    setCopiedPhase(content.text);
    setPhaseMenu(null);
    setNotice("Aşama metni kopyalandı");
    copySystemText(content.text);
  }
  function copyPhaseColor() {
    if (phaseMenu?.projectIds.length) {
      copyProjectRows("color", phaseMenu.projectIds);
      return;
    }
    const content = selectedPhase();
    if (!content) return;
    setCopiedRows((previous) => ({ ...previous, color: undefined }));
    setCopiedPhaseColor(content.color);
    setPhaseMenu(null);
    setNotice("Aşama rengi kopyalandı");
  }
  function copyPhaseBundle() {
    if (phaseMenu?.projectIds.length) {
      copyProjectRows("bundle", phaseMenu.projectIds);
      return;
    }
    const content = selectedPhase();
    if (!content) return;
    setCopiedRows((previous) => ({ ...previous, bundle: undefined }));
    setCopiedPhaseBundle(content);
    setPhaseMenu(null);
    setNotice("Aşama metni ve rengi birlikte kopyalandı");
    copySystemText(content.text);
  }
  async function paste(
    prepare: (data: Data) => Change<"project">,
    notice: string,
  ) {
    if (!data || !isAdmin || saving) return;
    setPhaseMenu(null);
    setMilestoneMenu(null);
    try {
      await batch([prepare(data)]);
      setNotice(notice);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function pasteRows(kind: PhaseCopyKind, ids: string[]) {
    if (
      !data ||
      !isAdmin ||
      saving ||
      pastePending.current ||
      !copiedRows[kind]
    )
      return;
    pastePending.current = true;
    try {
      const changes = preparePhaseRowsPaste(data, ids, copiedRows[kind]!, kind);
      await batch(changes);
      setPhaseMenu(null);
      clearProjectSelection();
      setNotice(ids.length + " proje satırına aşamalar yapıştırıldı.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      pastePending.current = false;
    }
  }
  async function pastePhaseContent(content: PhasePaste, label: string) {
    if (!phaseMenu) return;
    const target = phaseMenu;
    if (target.projectIds.length) {
      if (!data || !isAdmin || saving || pastePending.current) return;
      pastePending.current = true;
      try {
        await batch(preparePhaseRowsFill(data, target.projectIds, content));
        setPhaseMenu(null);
        clearProjectSelection();
        setNotice(label + " seçili proje satırlarının tüm aylarına uygulandı.");
      } catch (error) {
        setError((error as Error).message);
      } finally {
        pastePending.current = false;
      }
      return;
    }
    const name =
      data?.projects.find((project) => project.id === target.projectId)?.name ||
      "";
    await paste(
      (data) => preparePhasePaste(data, target, content),
      label +
        " " +
        name +
        " / " +
        monthLabel(target.month) +
        " hücresine yapıştırıldı",
    );
  }
  async function pastePhase() {
    if (phaseMenu && copiedRows.text) {
      await pasteRows(
        "text",
        phaseMenu.projectIds.length
          ? phaseMenu.projectIds
          : [phaseMenu.projectId],
      );
      return;
    }
    if (copiedPhase !== null)
      await pastePhaseContent(
        { kind: "text", text: copiedPhase },
        "Aşama metni",
      );
  }
  async function pastePhaseColor() {
    if (phaseMenu && copiedRows.color) {
      await pasteRows(
        "color",
        phaseMenu.projectIds.length
          ? phaseMenu.projectIds
          : [phaseMenu.projectId],
      );
      return;
    }
    if (copiedPhaseColor !== null)
      await pastePhaseContent(
        { kind: "color", color: copiedPhaseColor },
        "Aşama rengi",
      );
  }
  async function pastePhaseBundle() {
    if (phaseMenu && copiedRows.bundle) {
      await pasteRows(
        "bundle",
        phaseMenu.projectIds.length
          ? phaseMenu.projectIds
          : [phaseMenu.projectId],
      );
      return;
    }
    if (copiedPhaseBundle)
      await pastePhaseContent(
        { kind: "bundle", ...copiedPhaseBundle },
        "Aşama metni ve rengi",
      );
  }
  function copyMilestoneColor() {
    if (!milestoneMenu || !data) return;
    try {
      setCopiedRows((previous) => ({ ...previous, color: undefined }));
      setCopiedPhaseColor(milestoneClipboardColor(data, milestoneMenu));
      setMilestoneMenu(null);
      setNotice("Bar rengi kopyalandı");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function pasteMilestoneColor() {
    if (!milestoneMenu || copiedPhaseColor === null) return;
    const target = milestoneMenu,
      color = copiedPhaseColor;
    await paste(
      (data) => prepareMilestoneColorPaste(data, target, color),
      "Bar rengi yapıştırıldı",
    );
  }
  useEffect(() => {
    if (!active) return;
    const outside = (event: PointerEvent) => {
      if (!selectedProjectIds.length) return;
      const target = event.target;
      if (
        target instanceof Node &&
        !projectTableRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        clearProjectSelection();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearProjectSelection();
        setPhaseMenu(null);
        return;
      }
      if (
        !selectedProjectIds.length ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input:not([type="checkbox"]),textarea,[contenteditable="true"]',
        )
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        copyProjectRows("bundle", orderedSelection());
      }
      if (key === "v" && copiedRows[lastRowCopyKind] && isAdmin && !saving) {
        event.preventDefault();
        void pasteRows(lastRowCopyKind, orderedSelection());
      }
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", keyboard);
    };
  });
  return {
    projectTableRef,
    selectedProjectIds,
    toggleProjectRow,
    selectAllProjectRows,
    clearProjectSelection,
    openProjectRowMenu,
    canPastePhase: (kind: PhaseCopyKind) =>
      !!copiedRows[kind] ||
      (kind === "text"
        ? copiedPhase !== null
        : kind === "color"
          ? copiedPhaseColor !== null
          : copiedPhaseBundle !== null),
    copiedRowCounts: {
      text: copiedRows.text?.rows.length || 0,
      color: copiedRows.color?.rows.length || 0,
      bundle: copiedRows.bundle?.rows.length || 0,
    },
    menuRef,
    phaseMenu,
    setPhaseMenu,
    milestoneMenu,
    setMilestoneMenu,
    copiedPhase,
    copiedPhaseColor,
    copiedPhaseBundle,
    openPhaseMenu,
    openMilestoneMenu,
    copyPhase,
    copyPhaseColor,
    copyPhaseBundle,
    pastePhase,
    pastePhaseColor,
    pastePhaseBundle,
    copyMilestoneColor,
    pasteMilestoneColor,
  };
}
