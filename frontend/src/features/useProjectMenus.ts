import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Data, Project, Milestone } from "../model";
import type { Change } from "../../../shared/commands";
import {
  milestoneClipboardColor,
  prepareMilestoneColorPaste,
  type PhaseTarget,
  type MilestoneTarget,
} from "./project-clipboard";
import { usePhaseGrid } from "./usePhaseGrid";
type Position = { x: number; y: number };
type Props = {
  data: Data | null;
  visibleProjects: Project[];
  months: string[];
  active: boolean;
  selectionKey: string;
  isAdmin: boolean;
  saving: boolean;
  batch: (changes: Change[]) => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};
function menuPosition(
  event: MouseEvent<HTMLButtonElement>,
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
export function useProjectMenus({
  data,
  visibleProjects,
  months,
  active,
  selectionKey,
  isAdmin,
  saving,
  batch,
  setNotice,
  setError,
}: Props) {
  const phaseGrid = usePhaseGrid({
    data,
    visibleProjects,
    months,
    active,
    selectionKey,
    isAdmin,
    saving,
    batch,
    setNotice,
    setError,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const [phaseMenu, setPhaseMenu] = useState<(PhaseTarget & Position) | null>(
    null,
  );
  const [milestoneMenu, setMilestoneMenu] = useState<
    (MilestoneTarget & Position) | null
  >(null);
  const copiedPhase = phaseGrid.clipboards.text || null;
  const copiedPhaseColor =
    phaseGrid.clipboards.color?.rowCount === 1 &&
    phaseGrid.clipboards.color.columnCount === 1
      ? phaseGrid.clipboards.color.values[0][0].color
      : null;
  const copiedPhaseBundle = phaseGrid.clipboards.bundle || null;
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
    phaseGrid.selectAnchor(phaseGrid.key(project.id, month));
    setPhaseMenu({ projectId: project.id, month, ...menuPosition(event, 320) });
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
  function copyPhase() {
    if (!phaseMenu) return;
    phaseGrid.copy(
      "text",
      phaseGrid.menuSelection(
        phaseGrid.key(phaseMenu.projectId, phaseMenu.month),
      ),
    );
    setPhaseMenu(null);
  }
  function copyPhaseColor() {
    if (!phaseMenu) return;
    phaseGrid.copy(
      "color",
      phaseGrid.menuSelection(
        phaseGrid.key(phaseMenu.projectId, phaseMenu.month),
      ),
    );
    setPhaseMenu(null);
  }
  function copyPhaseBundle() {
    if (!phaseMenu) return;
    phaseGrid.copy(
      "bundle",
      phaseGrid.menuSelection(
        phaseGrid.key(phaseMenu.projectId, phaseMenu.month),
      ),
    );
    setPhaseMenu(null);
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
  async function pastePhase() {
    if (!phaseMenu) return;
    const key = phaseGrid.key(phaseMenu.projectId, phaseMenu.month);
    await phaseGrid.paste("text", key, phaseGrid.menuSelection(key));
    setPhaseMenu(null);
  }
  async function pastePhaseColor() {
    if (!phaseMenu) return;
    const key = phaseGrid.key(phaseMenu.projectId, phaseMenu.month);
    await phaseGrid.paste("color", key, phaseGrid.menuSelection(key));
    setPhaseMenu(null);
  }
  async function pastePhaseBundle() {
    if (!phaseMenu) return;
    const key = phaseGrid.key(phaseMenu.projectId, phaseMenu.month);
    await phaseGrid.paste("bundle", key, phaseGrid.menuSelection(key));
    setPhaseMenu(null);
  }
  function copyMilestoneColor() {
    if (!milestoneMenu || !data) return;
    try {
      phaseGrid.copyColor(milestoneClipboardColor(data, milestoneMenu));
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
  return {
    phaseGrid,
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
