import type { Data } from "./model.ts";
import {
  DEFAULT_MONTHLY_HOURS,
  effectivePersonHoursInMonth,
  trainingHoursInMonth,
} from "./actual-units.ts";

type LimitData = Pick<
  Data,
  | "resources"
  | "actualAllocations"
  | "actualWorkedHours"
  | "workCalendar"
  | "personCalendar"
>;

/** Check final write totals; historical reads and unrelated edits stay independent. */
export function assertActualMonthlyLimits(
  data: LimitData,
  selectedMonths?: Iterable<string>,
): void {
  const months =
    selectedMonths === undefined ? new Set<string>() : new Set(selectedMonths);
  const totals = new Map<string, number>();
  for (const [key, amount] of Object.entries(data.actualAllocations || {})) {
    const [resourceId, , month] = key.split("|");
    const personMonth = resourceId + "|" + month;
    if (selectedMonths === undefined) months.add(personMonth);
    if (months.has(personMonth))
      totals.set(personMonth, (totals.get(personMonth) || 0) + amount);
  }
  if (selectedMonths === undefined)
    for (const key of Object.keys(data.personCalendar || {})) {
      const [resourceId, date] = key.split("|");
      months.add(resourceId + "|" + date.slice(0, 7));
    }
  const resources = new Map(
    data.resources.map((resource) => [resource.id, resource]),
  );
  for (const key of months) {
    const [resourceId, month] = key.split("|");
    const resource = resources.get(resourceId);
    if (!resource) continue;
    const limit =
      effectivePersonHoursInMonth(
        month,
        resourceId,
        data.actualWorkedHours?.[key],
        data.workCalendar,
        data.personCalendar,
      ) / DEFAULT_MONTHLY_HOURS;
    const total =
      (totals.get(key) || 0) +
      trainingHoursInMonth(
        month,
        resourceId,
        data.workCalendar,
        data.personCalendar,
      ) /
        DEFAULT_MONTHLY_HOURS;
    if (total > limit + 1e-9)
      throw Object.assign(
        Error(
          resource.name +
            " · " +
            month +
            ": Proje dağılımı ve eğitim toplamı kişinin çalışma süresinin %100'ünü aşıyor. Lütfen dağılımı veya çalışma saatini kontrol edin.",
        ),
        { status: 400 },
      );
  }
}
