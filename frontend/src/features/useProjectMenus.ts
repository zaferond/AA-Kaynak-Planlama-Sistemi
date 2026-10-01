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
} from "./project-clipboard";
type Position = { x: number; y: number };
type Props = {
  data: Data | null;
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
  return {
    x: Math.max(
      8,
      Math.min(event.clientX || rect.left, window.innerWidth - 220),
    ),
    y: Math.max(
      8,
      Math.min(event.clientY || rect.bottom, window.innerHeight - height),
    ),
  };
}
function copySystemText(text: string) {
  if (navigator.clipboard && window.isSecureContext)
    void navigator.clipboard.writeText(text).catch(() => {});
}
export function useProjectMenus({
  data,
  isAdmin,
  saving,
  batch,
  setNotice,
  setError,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [phaseMenu, setPhaseMenu] = useState<(PhaseTarget & Position) | null>(
    null,
  );
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
  function selectedPhase() {
    const project = data?.projects.find(
      (project) => project.id === phaseMenu?.projectId,
    );
    return project && phaseMenu
      ? phaseClipboard(project, phaseMenu.month)
      : null;
  }
  function copyPhase() {
    const content = selectedPhase();
    if (!content?.text) return;
    setCopiedPhase(content.text);
    setPhaseMenu(null);
    setNotice("Aşama metni kopyalandı");
    copySystemText(content.text);
  }
  function copyPhaseColor() {
    const content = selectedPhase();
    if (!content) return;
    setCopiedPhaseColor(content.color);
    setPhaseMenu(null);
    setNotice("Aşama rengi kopyalandı");
  }
  function copyPhaseBundle() {
    const content = selectedPhase();
    if (!content) return;
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
  async function pastePhaseContent(content: PhasePaste, label: string) {
    if (!phaseMenu) return;
    const target = phaseMenu;
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
    if (copiedPhase !== null)
      await pastePhaseContent(
        { kind: "text", text: copiedPhase },
        "Aşama metni",
      );
  }
  async function pastePhaseColor() {
    if (copiedPhaseColor !== null)
      await pastePhaseContent(
        { kind: "color", color: copiedPhaseColor },
        "Aşama rengi",
      );
  }
  async function pastePhaseBundle() {
    if (copiedPhaseBundle)
      await pastePhaseContent(
        { kind: "bundle", ...copiedPhaseBundle },
        "Aşama metni ve rengi",
      );
  }
  function copyMilestoneColor() {
    if (!milestoneMenu || !data) return;
    try {
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
  return {
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
