export type ActualUnit = "percent" | "days" | "hours";
export const HOURS_PER_WORKDAY = 9;
export const DEFAULT_MONTHLY_HOURS = 180;
export const MAX_RECORDED_MONTHLY_HOURS = 1000;
export const DEFAULT_MONTHLY_DAYS = DEFAULT_MONTHLY_HOURS / HOURS_PER_WORKDAY;
export type CalendarDay = {
  type: "official" | "religious" | "company";
  label: string;
  fraction: 0.5 | 1;
};
export type WorkCalendar = Record<string, CalendarDay>;
export type PersonDay = {
  type: "leave" | "training";
  hours: number;
  label: string;
};
export type PersonCalendar = Record<string, PersonDay>;

/** Legacy entries retain their IDs; new types get independent per-day records. */
export function personDayKey(
  resourceId: string,
  date: string,
  type: PersonDay["type"],
  calendar: PersonCalendar = {},
): string {
  const legacy = resourceId + "|" + date;
  return calendar[legacy]?.type === type ? legacy : legacy + "|" + type;
}

export function personalDayEntries(
  resourceId: string,
  date: string,
  calendar: PersonCalendar = {},
): PersonDay[] {
  const key = resourceId + "|" + date;
  return [
    calendar[key],
    calendar[key + "|leave"],
    calendar[key + "|training"],
  ].filter((entry): entry is PersonDay => !!entry);
}

/** Historical Monday-Friday capacity, used when converting stored allocations to the 180-hour baseline. */
export function workdaysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  let workdays = 0;
  for (let day = 1; day <= lastDay; day++) {
    const weekday = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
    if (weekday >= 1 && weekday <= 5) workdays++;
  }
  return workdays;
}

/** Weekends never contribute hours; marked weekdays subtract full or half days. */
export function calendarHoursInMonth(
  month: string,
  calendar: WorkCalendar = {},
): number {
  const year = Number(month.slice(0, 4)),
    monthIndex = Number(month.slice(5, 7)) - 1;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  let hours = 0;
  for (let day = 1; day <= lastDay; day++) {
    const weekday = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const date = month + "-" + String(day).padStart(2, "0");
    hours += HOURS_PER_WORKDAY * (1 - (calendar[date]?.fraction || 0));
  }
  return hours;
}

/** Leave reduces capacity; training uses working time and counts as distributed work. */
export function personCalendarHoursInMonth(
  month: string,
  resourceId: string,
  calendar: WorkCalendar = {},
  personal: PersonCalendar = {},
): { baseHours: number; leaveHours: number; trainingHours: number } {
  const year = Number(month.slice(0, 4)),
    monthIndex = Number(month.slice(5, 7)) - 1;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  let baseHours = 0,
    leaveHours = 0,
    trainingHours = 0;
  for (let day = 1; day <= lastDay; day++) {
    const weekday = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const date = month + "-" + String(day).padStart(2, "0");
    const available = HOURS_PER_WORKDAY * (1 - (calendar[date]?.fraction || 0));
    baseHours += available;
    const entries = personalDayEntries(resourceId, date, personal);
    const leave = Math.min(
      entries
        .filter((entry) => entry.type === "leave")
        .reduce((sum, entry) => sum + entry.hours, 0),
      available,
    );
    const training = Math.min(
      entries
        .filter((entry) => entry.type === "training")
        .reduce((sum, entry) => sum + entry.hours, 0),
      available - leave,
    );
    leaveHours += leave;
    trainingHours += training;
  }
  return { baseHours, leaveHours, trainingHours };
}

export function personHoursInMonth(
  month: string,
  resourceId: string,
  calendar: WorkCalendar = {},
  personal: PersonCalendar = {},
): number {
  const { baseHours, leaveHours } = personCalendarHoursInMonth(
    month,
    resourceId,
    calendar,
    personal,
  );
  return baseHours - leaveHours;
}

export function leaveHoursInMonth(
  month: string,
  resourceId: string,
  calendar: WorkCalendar = {},
  personal: PersonCalendar = {},
): number {
  return personCalendarHoursInMonth(month, resourceId, calendar, personal)
    .leaveHours;
}

export function trainingHoursInMonth(
  month: string,
  resourceId: string,
  calendar: WorkCalendar = {},
  personal: PersonCalendar = {},
): number {
  return personCalendarHoursInMonth(month, resourceId, calendar, personal)
    .trainingHours;
}

/** A manual monthly hour value represents the month before marked holidays and leave. */
export function effectivePersonHoursInMonth(
  month: string,
  resourceId: string,
  manual: number | undefined,
  calendar: WorkCalendar = {},
  personal: PersonCalendar = {},
): number {
  return personMonthHours(month, resourceId, manual, calendar, personal)
    .effectiveHours;
}

/** One calendar calculation supplies display hours, stored-hour conversion and training. */
export function personMonthHours(
  month: string,
  resourceId: string,
  manual: number | undefined,
  calendar: WorkCalendar = {},
  personal: PersonCalendar = {},
) {
  const totals = personCalendarHoursInMonth(
    month,
    resourceId,
    calendar,
    personal,
  );
  const autoHours = totals.baseHours - totals.leaveHours;
  const nonWorkingHours =
    workdaysInMonth(month) * HOURS_PER_WORKDAY -
    totals.baseHours +
    totals.leaveHours;
  return {
    ...totals,
    autoHours,
    nonWorkingHours,
    effectiveHours:
      manual === undefined ? autoHours : Math.max(0, manual - nonWorkingHours),
    maxEffectiveHours: Math.max(
      0,
      MAX_RECORDED_MONTHLY_HOURS - nonWorkingHours,
    ),
  };
}

/** One person-month is 180 hours; a person's recorded hours may include overtime. */
export function actualInputToFte(
  value: number,
  unit: ActualUnit,
  _month: string,
  workedHours?: number,
): number {
  if (unit === "percent")
    return (
      ((value / 100) * (workedHours ?? DEFAULT_MONTHLY_HOURS)) /
      DEFAULT_MONTHLY_HOURS
    );
  if (unit === "days")
    return (value * HOURS_PER_WORKDAY) / DEFAULT_MONTHLY_HOURS;
  return value / DEFAULT_MONTHLY_HOURS;
}

export function fteToActualInput(
  value: number,
  unit: ActualUnit,
  _month: string,
  workedHours?: number,
): number {
  if (unit === "percent") {
    const hours = workedHours ?? DEFAULT_MONTHLY_HOURS;
    return hours === 0 ? 0 : ((value * DEFAULT_MONTHLY_HOURS) / hours) * 100;
  }
  if (unit === "days") return value * DEFAULT_MONTHLY_DAYS;
  return value * DEFAULT_MONTHLY_HOURS;
}
