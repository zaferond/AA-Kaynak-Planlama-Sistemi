import type { Change } from "../../../shared/commands.ts";
import type { Data } from "../../../shared/model.ts";
import type {
  CalendarDay,
  PersonDay,
  WorkCalendar,
} from "../../../shared/actual-units.ts";
import {
  personDayKey,
  HOURS_PER_WORKDAY,
} from "../../../shared/actual-units.ts";
import {
  personDaySchema,
  PERSONAL_HOURS_STEP,
} from "../../../shared/calendar-rules.ts";
import { validPlanningDate } from "../../../shared/planning-dates.ts";

export const CALENDAR_DAY_TYPES: { id: CalendarDay["type"]; label: string }[] =
  [
    { id: "official", label: "Resmî Tatil" },
    { id: "religious", label: "Bayram Tatili" },
    { id: "company", label: "Otokar Çalışma Dışı" },
  ];
export type CalendarDraft = { calendar: WorkCalendar; revision: number };

/** The revision belongs to the edited snapshot, even if background data refreshes. */
export function startCalendarDraft(data: Data): CalendarDraft {
  return {
    calendar: structuredClone(data.workCalendar || {}),
    revision: data.revisions["calendar:shared"] || 0,
  };
}

export function addCalendarDates(
  draft: CalendarDraft,
  input: {
    from: string;
    to: string;
    type: CalendarDay["type"];
    label: string;
    fraction: CalendarDay["fraction"];
  },
): CalendarDraft {
  const { from, type, fraction } = input;
  const end = input.to || from;
  if (!validPlanningDate(from) || !validPlanningDate(end))
    throw Error("Geçerli başlangıç ve bitiş tarihleri seçin.");
  if (end < from) throw Error("Bitiş tarihi başlangıçtan önce olamaz.");
  const first = new Date(from + "T12:00:00Z");
  const count =
    Math.round((Date.parse(end + "T12:00:00Z") - first.getTime()) / 86400000) +
    1;
  if (count > 62)
    throw Error("Bir seferde en fazla 62 günlük aralık ekleyebilirsiniz.");
  const name =
    input.label.trim() ||
    CALENDAR_DAY_TYPES.find((item) => item.id === type)!.label;
  if (name.length > 100)
    throw Error("Açıklama en fazla 100 karakter olabilir.");
  const calendar = { ...draft.calendar };
  for (let index = 0; index < count; index++) {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + index);
    calendar[date.toISOString().slice(0, 10)] = { type, label: name, fraction };
  }
  return { ...draft, calendar };
}

export function prepareCalendarChange(
  draft: CalendarDraft,
): Change<"calendar"> {
  return {
    kind: "calendar",
    id: "shared",
    value: structuredClone(draft.calendar),
    revision: draft.revision,
  };
}

export function preparePersonalDayChange(
  data: Data,
  resourceId: string,
  input: {
    date: string;
    type: PersonDay["type"];
    hours: string;
    label: string;
  },
): Change<"personDay"> {
  if (!data.resources.some((resource) => resource.id === resourceId))
    throw Error(
      "Çalışan kaynak bulunamadı. Verileri yenileyip tekrar deneyin.",
    );
  if (!validPlanningDate(input.date))
    throw Error("İzin veya eğitim için geçerli tarih seçin.");
  const entry = personDaySchema.safeParse({
    type: input.type,
    hours: Number(input.hours.replace(",", ".")),
    label: input.label.trim(),
  });
  if (!entry.success)
    throw Error(
      `Saat ${PERSONAL_HOURS_STEP.toLocaleString("tr-TR")} ile ${HOURS_PER_WORKDAY} arasında, yarım saatlik adımlarla; açıklama en fazla 100 karakter girilmelidir.`,
    );
  const id = personDayKey(
    resourceId,
    input.date,
    input.type,
    data.personCalendar,
  );
  return {
    kind: "personDay",
    id,
    value: entry.data,
    revision: data.revisions["personDay:" + id] || 0,
  };
}

export function preparePersonalDayRemoval(
  data: Data,
  resourceId: string,
  id: string,
): Change<"personDay"> {
  if (!id.startsWith(resourceId + "|") || !data.personCalendar?.[id])
    throw Error(
      "İzin veya eğitim kaydı bulunamadı. Verileri yenileyip tekrar deneyin.",
    );
  return {
    kind: "personDay",
    id,
    value: null,
    revision: data.revisions["personDay:" + id] || 0,
    operation: "delete",
  };
}
