import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import type { Milestone, Project } from "./model";
import {
  periodOverlapsProject,
  phaseInitial,
  phaseMonthForPeriod,
} from "./timeline-periods";
import type { TimelinePeriod } from "./timeline-periods";
import { phasePalette, phaseStyle } from "./model";
import ProjectResponsible from "./ProjectResponsible";
import {
  changeMilestoneNoteDates,
  milestoneRanges,
  noteDates,
  rangeNotes,
  resizeMilestoneRange,
  shiftCalendarDate,
  shiftMilestoneRange,
  visibleMilestoneBarStyle,
} from "./milestone-ranges";
import {
  calendarDayDifference,
  dateAtPeriodPosition,
  milestoneBarsForPeriods,
} from "./milestone-bars";
import {
  daysForWeekDrag,
  weeklyLaneGeometry,
  weeklyNoteLayout,
} from "./weekly-note-bars";
import type { WeeklyNoteBar } from "./weekly-note-bars";

const monthFormat = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "numeric",
});
const monthLabel = (month: string) =>
  monthFormat.format(new Date(month + "-01T12:00:00"));
const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateLabel = (date: string) =>
  dateFormat.format(new Date(date + "T12:00:00"));
const barDateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const barDateLabel = (date: string) =>
  barDateFormat.format(new Date(date + "T12:00:00"));

function positionPointerTooltip(
  tooltip: HTMLElement | null,
  x: number,
  y: number,
) {
  if (!tooltip) return;
  const { width, height } = tooltip.getBoundingClientRect();
  const gap = 12;
  const left = Math.max(8, Math.min(x + gap, window.innerWidth - width - 8));
  const top =
    y + gap + height + 8 <= window.innerHeight
      ? y + gap
      : Math.max(8, y - height - gap);
  const zoom =
    Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  tooltip.style.left = left / zoom + "px";
  tooltip.style.top = top / zoom + "px";
}

type Props = {
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

type MilestoneTrackProps = Pick<
  Props,
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

type DragMode = "move" | "start" | "end";
type DragState = {
  pointerId: number;
  rangeIndex: number;
  mode: DragMode;
  startX: number;
  startDate: string;
  timer: ReturnType<typeof setTimeout> | null;
  active: boolean;
  cancelled: boolean;
  moved: boolean;
  days: number;
  valid: boolean;
};
type DragPreview = {
  rangeIndex: number;
  mode: DragMode;
  days: number;
  start: string;
  end: string;
  message: string;
  x: number;
  y: number;
};
type NoteDragState = {
  pointerId: number;
  rangeIndex: number;
  noteIndex: number;
  mode: DragMode;
  startX: number;
  timer: ReturnType<typeof setTimeout> | null;
  active: boolean;
  moved: boolean;
  days: number;
  valid: boolean;
};
type NoteDragPreview = DragPreview & { noteIndex: number };

function MilestoneTrack({
  project,
  milestone,
  ranges,
  bars,
  periods,
  weeklyLayout,
  isAdmin,
  saving,
  onEditMilestone,
  onMilestoneContextMenu,
  onChangeMilestoneRange,
  onChangeMilestoneNote,
}: MilestoneTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [trackHeight, setTrackHeight] = useState(36);
  const [weeklyLaneHeights, setWeeklyLaneHeights] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const noteDragRef = useRef<NoteDragState | null>(null);
  const [notePreview, setNotePreview] = useState<NoteDragPreview | null>(null);
  const [hoveredNote, setHoveredNote] = useState<WeeklyNoteBar | null>(null);
  const noteTooltipRef = useRef<HTMLDivElement>(null);
  const notePointerRef = useRef({ x: 0, y: 0 });

  useEffect(
    () => () => {
      if (dragRef.current?.timer) clearTimeout(dragRef.current.timer);
      if (noteDragRef.current?.timer) clearTimeout(noteDragRef.current.timer);
    },
    [],
  );
  useEffect(() => setHoveredNote(null), [periods]);
  useLayoutEffect(() => {
    if (hoveredNote)
      positionPointerTooltip(
        noteTooltipRef.current,
        notePointerRef.current.x,
        notePointerRef.current.y,
      );
  }, [hoveredNote]);
  useEffect(() => {
    if (!hoveredNote) return;
    const hide = () => setHoveredNote(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hoveredNote]);

  function beginDrag(
    event: PointerEvent<HTMLElement>,
    rangeIndex: number,
    mode: DragMode,
  ) {
    if (
      !isAdmin ||
      saving ||
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      !trackRef.current
    )
      return;
    const rect = trackRef.current.getBoundingClientRect();
    const startDate = dateAtPeriodPosition(
      event.clientX,
      rect.left,
      rect.width,
      periods,
    );
    const range = ranges[rangeIndex];
    const drag: DragState = {
      pointerId: event.pointerId,
      rangeIndex,
      mode,
      startX: event.clientX,
      startDate,
      timer: null,
      active: mode !== "move",
      cancelled: false,
      moved: false,
      days: 0,
      valid: true,
    };
    if (mode === "move")
      drag.timer = setTimeout(() => {
        if (dragRef.current !== drag || drag.cancelled) return;
        drag.active = true;
        setDragging(true);
        setPreview({
          rangeIndex,
          mode,
          days: 0,
          start: range.start,
          end: range.end,
          message: "",
          x: event.clientX,
          y: event.clientY,
        });
      }, 350);
    else {
      setDragging(true);
      setPreview({
        rangeIndex,
        mode,
        days: 0,
        start: range.start,
        end: range.end,
        message: "",
        x: event.clientX,
        y: event.clientY,
      });
    }
    dragRef.current = drag;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active) {
      if (Math.abs(event.clientX - drag.startX) > 6) {
        if (drag.timer) clearTimeout(drag.timer);
        drag.timer = null;
        drag.cancelled = true;
        drag.moved = true;
      }
      return;
    }
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const date = dateAtPeriodPosition(
      event.clientX,
      rect.left,
      rect.width,
      periods,
    );
    const days = calendarDayDifference(drag.startDate, date);
    drag.days = days;
    if (days) drag.moved = true;
    const range = ranges[drag.rangeIndex];
    const start =
      drag.mode === "end" ? range.start : shiftCalendarDate(range.start, days);
    const end =
      drag.mode === "start" ? range.end : shiftCalendarDate(range.end, days);
    try {
      if (drag.mode === "move")
        shiftMilestoneRange(project, milestone, drag.rangeIndex, days);
      else
        resizeMilestoneRange(
          project,
          milestone,
          drag.rangeIndex,
          drag.mode,
          days,
        );
      drag.valid = true;
      setPreview({
        rangeIndex: drag.rangeIndex,
        mode: drag.mode,
        days,
        start,
        end,
        message: "",
        x: event.clientX,
        y: event.clientY,
      });
    } catch (error) {
      drag.valid = false;
      setPreview((current) => ({
        rangeIndex: drag.rangeIndex,
        mode: drag.mode,
        days: current?.days || 0,
        start,
        end,
        message: (error as Error).message,
        x: event.clientX,
        y: event.clientY,
      }));
    }
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.timer) clearTimeout(drag.timer);
    if (drag.moved) {
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    if (drag.active && drag.days !== 0 && drag.valid)
      void onChangeMilestoneRange(
        milestone,
        drag.rangeIndex,
        drag.mode,
        drag.days,
      );
    dragRef.current = null;
    setDragging(false);
    setPreview(null);
  }

  function cancelDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.timer) clearTimeout(drag.timer);
    dragRef.current = null;
    setDragging(false);
    setPreview(null);
  }

  function beginNoteDrag(
    event: PointerEvent<HTMLElement>,
    note: WeeklyNoteBar,
    mode: DragMode,
  ) {
    if (
      !isAdmin ||
      saving ||
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      !trackRef.current
    )
      return;
    setHoveredNote(null);
    const drag: NoteDragState = {
      pointerId: event.pointerId,
      rangeIndex: note.rangeIndex,
      noteIndex: note.noteIndex,
      mode,
      startX: event.clientX,
      timer: null,
      active: mode !== "move",
      moved: false,
      days: 0,
      valid: true,
    };
    const initialPreview: NoteDragPreview = {
      rangeIndex: note.rangeIndex,
      noteIndex: note.noteIndex,
      mode,
      days: 0,
      start: note.start,
      end: note.end,
      message: "",
      x: event.clientX,
      y: event.clientY,
    };
    noteDragRef.current = drag;
    if (mode === "move")
      drag.timer = setTimeout(() => {
        if (noteDragRef.current !== drag) return;
        drag.active = true;
        setNotePreview(initialPreview);
      }, 350);
    else setNotePreview(initialPreview);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveNoteDrag(event: PointerEvent<HTMLElement>) {
    const drag = noteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active) {
      if (Math.abs(event.clientX - drag.startX) > 6) {
        if (drag.timer) clearTimeout(drag.timer);
        drag.timer = null;
        drag.moved = true;
      }
      return;
    }
    if (Math.abs(event.clientX - drag.startX) > 5) drag.moved = true;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const days = daysForWeekDrag(
      drag.startX,
      event.clientX,
      rect.left,
      rect.width,
      periods,
    );
    drag.days = days;
    const note = rangeNotes(ranges[drag.rangeIndex])[drag.noteIndex];
    if (!note) return;
    const original = noteDates(note, ranges[drag.rangeIndex]);
    const start =
      drag.mode === "end"
        ? original.start
        : shiftCalendarDate(original.start, days);
    const end =
      drag.mode === "start"
        ? original.end
        : shiftCalendarDate(original.end, days);
    try {
      changeMilestoneNoteDates(
        project,
        milestone,
        drag.rangeIndex,
        drag.noteIndex,
        drag.mode,
        days,
      );
      drag.valid = true;
      setNotePreview({
        rangeIndex: drag.rangeIndex,
        noteIndex: drag.noteIndex,
        mode: drag.mode,
        days,
        start,
        end,
        message: "",
        x: event.clientX,
        y: event.clientY,
      });
    } catch (error) {
      drag.valid = false;
      setNotePreview({
        rangeIndex: drag.rangeIndex,
        noteIndex: drag.noteIndex,
        mode: drag.mode,
        days,
        start,
        end,
        message: (error as Error).message,
        x: event.clientX,
        y: event.clientY,
      });
    }
  }

  function endNoteDrag(event: PointerEvent<HTMLElement>) {
    const drag = noteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.timer) clearTimeout(drag.timer);
    if (drag.moved) {
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    if (drag.active && drag.days !== 0 && drag.valid)
      void onChangeMilestoneNote(
        milestone,
        drag.rangeIndex,
        drag.noteIndex,
        drag.mode,
        drag.days,
      );
    noteDragRef.current = null;
    setNotePreview(null);
  }

  function cancelNoteDrag(event: PointerEvent<HTMLElement>) {
    const drag = noteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.timer) clearTimeout(drag.timer);
    noteDragRef.current = null;
    setNotePreview(null);
  }

  useLayoutEffect(() => {
    if (weeklyLayout) return;
    const barElements = Array.from(
      trackRef.current?.querySelectorAll<HTMLButtonElement>(".gantt-bar") || [],
    );
    const updateHeight = () => {
      const nextHeight = Math.max(
        36,
        ...barElements.map((bar) => bar.offsetHeight + 12),
      );
      setTrackHeight((current) =>
        current === nextHeight ? current : nextHeight,
      );
    };
    const observer = new ResizeObserver(updateHeight);
    barElements.forEach((bar) => observer.observe(bar));
    updateHeight();
    return () => observer.disconnect();
  }, [bars, weeklyLayout]);

  const defaultColor =
    phasePalette.find((item) => item.id === (milestone.barColor || "red")) ||
    phasePalette[3];
  let displayedWeeklyLayout = weeklyLayout;
  if (weeklyLayout && notePreview?.days && !notePreview.message) {
    try {
      const changed = changeMilestoneNoteDates(
        project,
        milestone,
        notePreview.rangeIndex,
        notePreview.noteIndex,
        notePreview.mode,
        notePreview.days,
      );
      displayedWeeklyLayout = weeklyNoteLayout(
        milestoneRanges(changed),
        periods,
      );
    } catch {
      /* Keep the last valid layout while an invalid drag is shown in the status tooltip. */
    }
  }
  const weeklyGeometry = weeklyLaneGeometry(
    displayedWeeklyLayout?.laneCount || 0,
    weeklyLaneHeights,
  );
  useLayoutEffect(() => {
    if (!weeklyLayout) return;
    const boxes = Array.from(
      trackRef.current?.querySelectorAll<HTMLButtonElement>(
        ".weekly-note-box",
      ) || [],
    );
    const update = () => {
      const heights: number[] = [];
      for (const box of boxes) {
        const lane = Number(box.dataset.lane);
        if (Number.isInteger(lane) && lane >= 0)
          heights[lane] = Math.max(heights[lane] || 0, box.offsetHeight);
      }
      setWeeklyLaneHeights((previous) =>
        previous.length === heights.length &&
        previous.every((height, index) => height === heights[index])
          ? previous
          : heights,
      );
    };
    const observer = new ResizeObserver(update);
    boxes.forEach((box) => observer.observe(box));
    update();
    return () => observer.disconnect();
  }, [weeklyLayout, notePreview?.days]);
  const weeklyTrackHeight = weeklyLayout ? weeklyGeometry.height : trackHeight;
  const dragStatus = notePreview || preview;
  return (
    <div
      ref={trackRef}
      className={"milestone-track" + (weeklyLayout ? " weekly-note-track" : "")}
      style={
        {
          "--milestone-period-width": 100 / periods.length + "%",
          height: weeklyTrackHeight,
        } as CSSProperties
      }
    >
      {!weeklyLayout &&
        bars.map((bar, index) => {
          const rangeIndex = ranges.indexOf(bar.range);
          const changed =
            preview?.rangeIndex === rangeIndex && preview.days
              ? preview.mode === "move"
                ? shiftMilestoneRange(
                    project,
                    milestone,
                    rangeIndex,
                    preview.days,
                  )
                : resizeMilestoneRange(
                    project,
                    milestone,
                    rangeIndex,
                    preview.mode,
                    preview.days,
                  )
              : null;
          const displayed = changed
            ? milestoneBarsForPeriods(
                [milestoneRanges(changed)[rangeIndex]],
                periods,
              )[0] || bar
            : bar;
          const notes = rangeNotes(displayed.range).filter((note) =>
            note.text.trim(),
          );
          const entries = notes.length
            ? notes.map((note) => ({
                text: note.text,
                completed: !!note.completed,
                ...noteDates(note, displayed.range),
              }))
            : [
                {
                  text: milestone.name,
                  completed: false,
                  start: displayed.range.start,
                  end: displayed.range.end,
                },
              ];
          const details = entries.map(
            (entry) =>
              "• " +
              (entry.completed ? "Tamamlandı: " : "") +
              entry.text +
              " · " +
              dateLabel(entry.start) +
              " – " +
              dateLabel(entry.end),
          );
          const barColor =
            phasePalette.find((item) => item.id === bar.range.color) ||
            defaultColor;
          const barStyle = {
            "--gantt-color": barColor.ink,
            "--gantt-soft": barColor.bg,
            "--gantt-ink": barColor.ink,
            left: displayed.left + "%",
            width: displayed.width + "%",
          } as CSSProperties;
          return (
            <button
              type="button"
              key={index}
              className={
                "gantt-bar start end " +
                visibleMilestoneBarStyle(milestone.barStyle) +
                (isAdmin ? " editable" : "") +
                (dragging && preview?.rangeIndex === rangeIndex
                  ? " dragging"
                  : "")
              }
              style={barStyle}
              title={`${milestone.name} · ${dateLabel(displayed.range.start)} – ${dateLabel(displayed.range.end)}\n${details.join("\n")}${isAdmin ? "\nTıklayın: düzenle · Basılı tutup sürükleyin: taşı · Uçlardan sürükleyin: daralt / genişlet" : ""}`}
              aria-label={details.join(", ")}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (isAdmin && !saving) onEditMilestone(milestone);
              }}
              onPointerDown={(event) => beginDrag(event, rangeIndex, "move")}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              onContextMenu={(event) =>
                onMilestoneContextMenu(event, milestone, rangeIndex)
              }
            >
              <ul className="gantt-note-list">
                {entries.map((entry, noteIndex) => (
                  <li
                    key={noteIndex}
                    className={entry.completed ? "completed" : undefined}
                  >
                    <strong className="gantt-note-text">{entry.text}</strong>
                    <small className="gantt-note-dates">
                      <time dateTime={entry.start}>
                        {barDateLabel(entry.start)}
                      </time>{" "}
                      –{" "}
                      <time dateTime={entry.end}>
                        {barDateLabel(entry.end)}
                      </time>
                    </small>
                  </li>
                ))}
              </ul>
              {isAdmin &&
                (["start", "end"] as const).map((edge) => (
                  <span
                    key={edge}
                    className={"gantt-resize-handle " + edge}
                    role="presentation"
                    title={
                      edge === "start"
                        ? "Başlangıç tarihini sürükleyin"
                        : "Bitiş tarihini sürükleyin"
                    }
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      beginDrag(event, rangeIndex, edge);
                    }}
                    onPointerMove={(event) => {
                      event.stopPropagation();
                      moveDrag(event);
                    }}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      endDrag(event);
                    }}
                    onPointerCancel={(event) => {
                      event.stopPropagation();
                      cancelDrag(event);
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                ))}
            </button>
          );
        })}
      {displayedWeeklyLayout?.bars.map((note) => {
        const color =
          phasePalette.find((item) => item.id === note.color) || defaultColor;
        const active =
          notePreview?.rangeIndex === note.rangeIndex &&
          notePreview.noteIndex === note.noteIndex;
        return (
          <button
            type="button"
            key={`${note.rangeIndex}-${note.noteIndex}`}
            data-lane={note.lane}
            className={
              "weekly-note-box " +
              visibleMilestoneBarStyle(milestone.barStyle) +
              (note.completed ? " completed" : "") +
              (isAdmin ? " editable" : "") +
              (active ? " dragging" : "")
            }
            style={
              {
                left: note.left + "%",
                width: note.width + "%",
                top: weeklyGeometry.tops[note.lane] ?? 5,
                "--gantt-color": color.ink,
                "--gantt-soft": color.bg,
                "--gantt-ink": color.ink,
              } as CSSProperties
            }
            aria-label={`${note.text} · ${dateLabel(note.start)} – ${dateLabel(note.end)}${note.completed ? " · Tamamlandı" : ""}`}
            onMouseEnter={(event) => {
              if (noteDragRef.current) return;
              notePointerRef.current = { x: event.clientX, y: event.clientY };
              setHoveredNote(note);
            }}
            onMouseMove={(event) => {
              if (noteDragRef.current) return;
              notePointerRef.current = { x: event.clientX, y: event.clientY };
              positionPointerTooltip(
                noteTooltipRef.current,
                event.clientX,
                event.clientY,
              );
            }}
            onMouseLeave={() => setHoveredNote(null)}
            onFocus={(event) => {
              if (noteDragRef.current) return;
              const rect = event.currentTarget.getBoundingClientRect();
              notePointerRef.current = {
                x: rect.left + rect.width / 2,
                y: rect.bottom,
              };
              setHoveredNote(note);
            }}
            onBlur={() => setHoveredNote(null)}
            onClick={() => {
              setHoveredNote(null);
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (isAdmin && !saving) onEditMilestone(milestone);
            }}
            onContextMenu={(event) => {
              setHoveredNote(null);
              onMilestoneContextMenu(event, milestone, note.rangeIndex);
            }}
            onPointerDown={(event) => beginNoteDrag(event, note, "move")}
            onPointerMove={moveNoteDrag}
            onPointerUp={endNoteDrag}
            onPointerCancel={cancelNoteDrag}
          >
            <span className="weekly-note-text">{note.text}</span>
            <small>
              {barDateLabel(note.start)} – {barDateLabel(note.end)}
            </small>
            {isAdmin &&
              (["start", "end"] as const).map((edge) => (
                <span
                  key={edge}
                  className={"weekly-note-resize " + edge}
                  role="presentation"
                  title={
                    edge === "start"
                      ? "Başlangıç tarihini günlük olarak sürükleyin"
                      : "Bitiş tarihini günlük olarak sürükleyin"
                  }
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginNoteDrag(event, note, edge);
                  }}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    moveNoteDrag(event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    endNoteDrag(event);
                  }}
                  onPointerCancel={(event) => {
                    event.stopPropagation();
                    cancelNoteDrag(event);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ))}
          </button>
        );
      })}
      {hoveredNote &&
        createPortal(
          <div
            ref={noteTooltipRef}
            className="project-phase-tooltip weekly-note-tooltip"
            role="tooltip"
            style={{ left: -10000, top: -10000 }}
          >
            <strong className={hoveredNote.completed ? "completed" : undefined}>
              {hoveredNote.text}
            </strong>
            <small>
              {dateLabel(hoveredNote.start)} – {dateLabel(hoveredNote.end)}
            </small>
            {hoveredNote.completed && <em>Tamamlandı</em>}
          </div>,
          document.body,
        )}
      {dragStatus &&
        createPortal(
          <div
            className={
              "gantt-drag-status" + (dragStatus.message ? " invalid" : "")
            }
            role="status"
            style={{
              left: Math.max(
                8,
                Math.min(dragStatus.x - 105, window.innerWidth - 222),
              ),
              top: Math.max(8, dragStatus.y - 94),
            }}
          >
            <strong>
              {notePreview
                ? dragStatus.mode === "move"
                  ? "Detay taşınıyor"
                  : dragStatus.mode === "start"
                    ? "Detay başlangıcı"
                    : "Detay bitişi"
                : dragStatus.mode === "move"
                  ? "Taşınıyor"
                  : dragStatus.mode === "start"
                    ? "Başlangıç ayarlanıyor"
                    : "Bitiş ayarlanıyor"}{" "}
              <span>
                {dragStatus.days > 0 ? "+" : ""}
                {dragStatus.days} gün
              </span>
            </strong>
            <div>
              <span>
                <small>Başlangıç</small>
                {dateLabel(dragStatus.start)}
              </span>
              <span>
                <small>Bitiş</small>
                {dateLabel(dragStatus.end)}
              </span>
            </div>
            {dragStatus.message ? (
              <p>{dragStatus.message}</p>
            ) : (
              <em>
                {calendarDayDifference(dragStatus.start, dragStatus.end) + 1}{" "}
                gün sürer
              </em>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function ProjectTimelineRows({
  project,
  periods,
  density,
  expandAllDetails,
  isAdmin,
  saving,
  onProjectInfo,
  onPhaseClick,
  onPhaseContextMenu,
  onAddMilestone,
  onEditMilestone,
  onDeleteMilestone,
  onMilestoneContextMenu,
  onChangeMilestoneRange,
  onChangeMilestoneNote,
}: Props) {
  const [expanded, setExpanded] = useState(expandAllDetails);
  const [hoveredPhase, setHoveredPhase] = useState("");
  const phaseTooltipRef = useRef<HTMLDivElement>(null);
  const phasePointerRef = useRef({ x: 0, y: 0 });
  useLayoutEffect(() => setExpanded(expandAllDetails), [expandAllDetails]);
  useEffect(() => setHoveredPhase(""), [periods]);
  useLayoutEffect(() => {
    if (hoveredPhase)
      positionPhaseTooltip(
        phasePointerRef.current.x,
        phasePointerRef.current.y,
      );
  }, [hoveredPhase]);
  useEffect(() => {
    if (!hoveredPhase) return;
    const hide = () => setHoveredPhase("");
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hoveredPhase]);
  function positionPhaseTooltip(x: number, y: number) {
    phasePointerRef.current = { x, y };
    const tooltip = phaseTooltipRef.current;
    if (!tooltip) return;
    const { width, height } = tooltip.getBoundingClientRect();
    const gap = 12;
    const left = Math.max(8, Math.min(x + gap, window.innerWidth - width - 8));
    const top =
      y + gap + height + 8 <= window.innerHeight
        ? y + gap
        : Math.max(8, y - height - gap);
    const zoom =
      Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    tooltip.style.left = left / zoom + "px";
    tooltip.style.top = top / zoom + "px";
  }
  const milestones = [...(project.milestones || [])].sort(
    (a, b) =>
      a.start.localeCompare(b.start) ||
      a.end.localeCompare(b.end) ||
      a.name.localeCompare(b.name, "tr"),
  );
  return (
    <>
      <TableRow className="project-main-row">
        <TableCell>
          <div className="project-name-cell">
            <button
              type="button"
              className="project-expand"
              aria-label={
                project.name +
                " kritik konularını " +
                (expanded ? "gizle" : "göster")
              }
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <ChevronDown size={14} /> : <Plus size={14} />}
            </button>
            <div className="project-name-copy">
              <button
                className="textbutton"
                disabled={!isAdmin}
                onClick={onProjectInfo}
              >
                {project.name}
              </button>
              <ProjectResponsible project={project} />
              <small>
                {project.start} → {project.end}
              </small>
            </div>
            {milestones.length > 0 && (
              <span
                className="milestone-count"
                title={milestones.length + " kritik konu"}
              >
                {milestones.length}
              </span>
            )}
          </div>
        </TableCell>
        {periods.map((period) => {
          const active = periodOverlapsProject(period, project);
          const month = phaseMonthForPeriod(period, project);
          const phaseText = active ? project.phases[month]?.trim() : "";
          return (
            <TableCell key={period.key}>
              <button
                className="phasebutton"
                disabled={!active}
                style={phaseStyle(project, month)}
                aria-label={
                  project.name +
                  " / " +
                  (period.kind === "week"
                    ? period.fullLabel
                    : monthLabel(month)) +
                  " aşama ayrıntısı" +
                  (phaseText ? ": " + phaseText : "")
                }
                onMouseEnter={
                  phaseText
                    ? (event) => {
                        phasePointerRef.current = {
                          x: event.clientX,
                          y: event.clientY,
                        };
                        setHoveredPhase(phaseText);
                      }
                    : undefined
                }
                onMouseMove={
                  phaseText
                    ? (event) =>
                        positionPhaseTooltip(event.clientX, event.clientY)
                    : undefined
                }
                onMouseLeave={() => setHoveredPhase("")}
                onFocus={
                  phaseText
                    ? (event) => {
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        phasePointerRef.current = {
                          x: rect.left + rect.width / 2,
                          y: rect.bottom,
                        };
                        setHoveredPhase(phaseText);
                      }
                    : undefined
                }
                onBlur={() => setHoveredPhase("")}
                onContextMenu={(event) => {
                  setHoveredPhase("");
                  onPhaseContextMenu(event, month);
                }}
                onClick={() => {
                  setHoveredPhase("");
                  onPhaseClick(month);
                }}
              >
                <span className="phasepreview">
                  {!active ? (
                    "-"
                  ) : density === "overview" ? (
                    phaseText ? (
                      <strong className="phase-initial">
                        {phaseInitial(phaseText)}
                      </strong>
                    ) : (
                      "-"
                    )
                  ) : (
                    phaseText || "-"
                  )}
                </span>
              </button>
            </TableCell>
          );
        })}
      </TableRow>
      {expanded && (
        <>
          {isAdmin && (
            <TableRow className="milestone-section-row">
              <TableCell colSpan={periods.length + 1}>
                <div className="milestone-section">
                  <button
                    type="button"
                    className="button milestone-add"
                    disabled={saving}
                    onClick={onAddMilestone}
                  >
                    <Plus size={14} />
                    Kritik Konu Ekle
                  </button>
                </div>
              </TableCell>
            </TableRow>
          )}
          {milestones.map((milestone) => {
            const ranges = milestoneRanges(milestone);
            const bars = milestoneBarsForPeriods(ranges, periods);
            const color =
              phasePalette.find(
                (item) => item.id === (milestone.barColor || "red"),
              ) || phasePalette[3];
            const weeklyLayout =
              periods[0]?.kind === "week"
                ? weeklyNoteLayout(ranges, periods)
                : null;
            return (
              <TableRow className="milestone-row" key={milestone.id}>
                <TableCell>
                  <div className="milestone-name-cell">
                    <span
                      className="milestone-symbol"
                      aria-hidden="true"
                      style={{ borderColor: color.border }}
                    />
                    <div className="milestone-name-copy">
                      <strong title={milestone.name}>{milestone.name}</strong>
                      <small
                        title={ranges
                          .map(
                            (range) =>
                              dateLabel(range.start) +
                              " – " +
                              dateLabel(range.end),
                          )
                          .join("\n")}
                      >
                        {ranges.length === 0
                          ? "Kritik detay konu eklenmedi"
                          : ranges.length === 1
                            ? dateLabel(ranges[0].start) +
                              " – " +
                              dateLabel(ranges[0].end)
                            : ranges.length + " tarih aralığı"}
                      </small>
                      {!!weeklyLayout?.undated.length && (
                        <div className="weekly-undated-notes">
                          <span>Tarihi belirtilmemiş detaylar</span>
                          {weeklyLayout.undated.map((note) => (
                            <button
                              type="button"
                              key={`${note.rangeIndex}-${note.noteIndex}`}
                              title={note.text}
                              className={
                                note.completed ? "completed" : undefined
                              }
                              onClick={() => {
                                if (isAdmin && !saving)
                                  onEditMilestone(milestone);
                              }}
                            >
                              {note.text}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="milestone-actions">
                        <button
                          type="button"
                          title="Kritik Konu Düzenle"
                          aria-label={milestone.name + " düzenle"}
                          disabled={saving}
                          onClick={() => onEditMilestone(milestone)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          title="Kritik Konuyu Sil"
                          aria-label={milestone.name + " sil"}
                          disabled={saving}
                          onClick={() => onDeleteMilestone(milestone)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  colSpan={periods.length}
                  className="milestone-month milestone-track-cell"
                >
                  {ranges.length ? (
                    <MilestoneTrack
                      project={project}
                      milestone={milestone}
                      ranges={ranges}
                      bars={bars}
                      periods={periods}
                      weeklyLayout={weeklyLayout}
                      isAdmin={isAdmin}
                      saving={saving}
                      onEditMilestone={onEditMilestone}
                      onMilestoneContextMenu={onMilestoneContextMenu}
                      onChangeMilestoneRange={onChangeMilestoneRange}
                      onChangeMilestoneNote={onChangeMilestoneNote}
                    />
                  ) : (
                    <div className="milestone-track milestone-track-empty">
                      Kritik detay konu eklenmedi
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </>
      )}
      {hoveredPhase &&
        createPortal(
          <div
            ref={phaseTooltipRef}
            className="project-phase-tooltip"
            role="tooltip"
            style={{ left: -10000, top: -10000 }}
          >
            {hoveredPhase}
          </div>,
          document.body,
        )}
    </>
  );
}
