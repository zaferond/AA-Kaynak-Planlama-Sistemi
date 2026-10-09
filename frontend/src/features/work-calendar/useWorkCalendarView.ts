import { useMemo } from "react";
import {
  calendarHoursInMonth,
  personCalendarHoursInMonth,
  HOURS_PER_WORKDAY,
  workdaysInMonth,
  type WorkCalendar,
} from "../../actual-units";
import type { WorkCalendarDialogProps } from "./types";
import { monthFormat } from "./format";
import {
  sharedCalendarRanges,
  personalCalendarRanges,
} from "./calendar-ranges";

export function useWorkCalendarView({
  data,
  mode,
  resource,
  year,
  calendar,
}: Pick<WorkCalendarDialogProps, "data" | "mode" | "resource"> & {
  year: number;
  calendar: WorkCalendar;
}) {
  const entries = useMemo(
    () =>
      sharedCalendarRanges(calendar).filter((range) =>
        range.keys.some((date) => date.startsWith(String(year) + "-")),
      ),
    [calendar, year],
  );
  const personalEntries = useMemo(
    () =>
      resource
        ? personalCalendarRanges(
            resource.id,
            data.personCalendar || {},
            calendar,
          ).filter((range) =>
            range.keys.some((key) => key.split("|")[1].startsWith(year + "-")),
          )
        : [],
    [data.personCalendar, resource?.id, calendar, year],
  );
  const monthRows = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = year + "-" + String(index + 1).padStart(2, "0");
        const weekdays = workdaysInMonth(month);
        const hours = calendarHoursInMonth(month, calendar);
        const personal =
          resource && mode === "personal"
            ? personCalendarHoursInMonth(
                month,
                resource.id,
                calendar,
                data.personCalendar,
              )
            : null;
        return {
          month,
          label: monthFormat.format(new Date(month + "-01T12:00:00")),
          weekdays,
          excluded: weekdays - hours / HOURS_PER_WORKDAY,
          hours,
          personal,
        };
      }),
    [calendar, year, mode, resource?.id, data.personCalendar],
  );
  return { entries, personalEntries, monthRows };
}
export type WorkCalendarView = ReturnType<typeof useWorkCalendarView>;
