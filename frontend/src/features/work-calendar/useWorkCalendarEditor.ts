import { useEffect, useState } from "react";
import type { WorkCalendar } from "../../actual-units";
import { HOURS_PER_WORKDAY } from "../../actual-units";
import { writeBatch } from "../../storage";
import {
  addCalendarDates,
  prepareCalendarChange,
  preparePersonalDayChange,
  preparePersonalDayRemoval,
  startCalendarDraft,
  type CalendarDraft,
} from "../calendar-commands";
import type {
  WorkCalendarDialogProps,
  SharedCalendarForm,
  PersonalCalendarForm,
} from "./types";

const emptyCalendar: WorkCalendar = {};

export function useWorkCalendarEditor({
  open,
  onOpenChange,
  data,
  mode,
  resource,
  canEdit,
  canEditPersonal,
  onSaved,
  initialYear,
}: WorkCalendarDialogProps) {
  const [year, setYear] = useState(initialYear);
  const [calendarDraft, setCalendarDraft] = useState<CalendarDraft | null>(
    null,
  );
  const draft =
    mode === "personal"
      ? data.workCalendar || emptyCalendar
      : calendarDraft?.calendar || emptyCalendar;
  const [sharedForm, setSharedForm] = useState<SharedCalendarForm>({
    from: "",
    to: "",
    type: "official",
    label: "",
    fraction: 1,
  });
  const [personalForm, setPersonalForm] = useState<PersonalCalendarForm>({
    date: "",
    type: "leave",
    hours: String(HOURS_PER_WORKDAY),
    label: "",
  });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Opening values/revision stay paired; a refreshed snapshot cannot rebase a shared draft.
  useEffect(() => {
    if (open) {
      setCalendarDraft(startCalendarDraft(data));
      setYear(initialYear);
      setDirty(false);
      setError("");
      setSharedForm((previous) => ({ ...previous, from: "", to: "" }));
      setPersonalForm((previous) => ({
        ...previous,
        date: "",
        hours: String(HOURS_PER_WORKDAY),
        label: "",
      }));
    }
  }, [open, initialYear, resource?.id, mode]);
  function updateShared<K extends keyof SharedCalendarForm>(
    key: K,
    value: SharedCalendarForm[K],
  ) {
    setSharedForm((previous) => ({ ...previous, [key]: value }));
  }
  function updatePersonal<K extends keyof PersonalCalendarForm>(
    key: K,
    value: PersonalCalendarForm[K],
  ) {
    setPersonalForm((previous) => ({ ...previous, [key]: value }));
  }
  function setSharedStart(from: string) {
    setSharedForm((previous) => ({
      ...previous,
      from,
      to: previous.to || from,
    }));
  }
  function addDates() {
    setError("");
    if (!calendarDraft || !canEdit || busy) return;
    try {
      setCalendarDraft(addCalendarDates(calendarDraft, sharedForm));
      setDirty(true);
      setYear(Number(sharedForm.from.slice(0, 4)));
      setSharedForm((previous) => ({
        ...previous,
        label: "",
        from: "",
        to: "",
      }));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function removeDate(date: string) {
    if (!calendarDraft || !canEdit || busy) return;
    setCalendarDraft((current) => {
      if (!current) return current;
      const calendar = { ...current.calendar };
      delete calendar[date];
      return { ...current, calendar };
    });
    setDirty(true);
  }
  async function save() {
    if (!canEdit || busy || !dirty || !calendarDraft) return;
    setBusy(true);
    setError("");
    try {
      const next = await writeBatch([prepareCalendarChange(calendarDraft)]);
      onSaved(next);
      onOpenChange(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function savePersonal() {
    if (!resource || !canEditPersonal || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await writeBatch([
        preparePersonalDayChange(data, resource.id, personalForm),
      ]);
      onSaved(next);
      setYear(Number(personalForm.date.slice(0, 4)));
      setPersonalForm((previous) => ({ ...previous, date: "", label: "" }));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removePersonal(id: string) {
    if (!resource || !canEditPersonal || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await writeBatch([
        preparePersonalDayRemoval(data, resource.id, id),
      ]);
      onSaved(next);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function requestOpenChange(value: boolean) {
    if (!busy) onOpenChange(value);
  }
  return {
    year,
    setYear,
    draft,
    sharedForm,
    personalForm,
    dirty,
    busy,
    error,
    updateShared,
    updatePersonal,
    setSharedStart,
    addDates,
    removeDate,
    save,
    savePersonal,
    removePersonal,
    requestOpenChange,
  };
}
export type WorkCalendarEditor = ReturnType<typeof useWorkCalendarEditor>;
