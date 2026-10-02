import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  changeMilestoneNoteDates,
  noteDates,
  rangeNotes,
  resizeMilestoneRange,
  shiftCalendarDate,
  shiftMilestoneRange,
} from "../milestone-ranges";
import { calendarDayDifference, dateAtPeriodPosition } from "../milestone-bars";
import { daysForWeekDrag, type WeeklyNoteBar } from "../weekly-note-bars";
import type { MilestoneTrackProps } from "./project-timeline-types";

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

type Props = Pick<
  MilestoneTrackProps,
  | "project"
  | "milestone"
  | "ranges"
  | "periods"
  | "isAdmin"
  | "saving"
  | "onChangeMilestoneRange"
  | "onChangeMilestoneNote"
> & {
  onBeginRange: () => void;
  onBeginNote: () => void;
};
export function useMilestoneDrag({
  project,
  milestone,
  ranges,
  periods,
  isAdmin,
  saving,
  onChangeMilestoneRange,
  onChangeMilestoneNote,
  onBeginRange,
  onBeginNote,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const noteDragRef = useRef<NoteDragState | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [notePreview, setNotePreview] = useState<NoteDragPreview | null>(null);
  useEffect(
    () => () => {
      if (dragRef.current?.timer) clearTimeout(dragRef.current.timer);
      if (noteDragRef.current?.timer) clearTimeout(noteDragRef.current.timer);
    },
    [],
  );
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
    onBeginRange();
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
    onBeginNote();
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

  return {
    isNoteDragging: () => !!noteDragRef.current,
    trackRef,
    suppressClickRef,
    dragging,
    preview,
    notePreview,
    beginDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    beginNoteDrag,
    moveNoteDrag,
    endNoteDrag,
    cancelNoteDrag,
  };
}
