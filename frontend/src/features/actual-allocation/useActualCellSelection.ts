import { useEffect, useState, type RefObject } from "react";
import type { Resource } from "../../model";
import type { ActualCellSelection } from "./types";

export function useActualCellSelection({
  scopeKey,
  visiblePage,
  eligible,
  months,
  currentMonth,
  people,
  limitOpenRef,
}: {
  scopeKey: string;
  visiblePage: number;
  eligible: ReadonlySet<string>;
  months: string[];
  currentMonth: string;
  people: Resource[];
  limitOpenRef: RefObject<boolean>;
}) {
  const [selectedCell, setSelectedCell] = useState<ActualCellSelection | null>(
    null,
  );
  useEffect(() => setSelectedCell(null), [scopeKey]);
  useEffect(() => setSelectedCell(null), [visiblePage]);
  useEffect(() => {
    const withinSelection = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest(
        '.person-allocation [data-actual-context-cell="true"], .person-allocation .actual-unit-control, .actual-limit-dialog, [data-write-recovery]',
      );
    const clearOutside = (event: Event) => {
      if (!limitOpenRef.current && !withinSelection(event.target))
        setSelectedCell(null);
    };
    const clearOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCell(null);
    };
    document.addEventListener("click", clearOutside);
    document.addEventListener("focusin", clearOutside);
    document.addEventListener("keydown", clearOnEscape);
    return () => {
      document.removeEventListener("click", clearOutside);
      document.removeEventListener("focusin", clearOutside);
      document.removeEventListener("keydown", clearOnEscape);
    };
  }, [limitOpenRef]);
  const selectedHoursMonth =
    selectedCell &&
    months.includes(selectedCell.month) &&
    selectedCell.month <= currentMonth
      ? selectedCell.month
      : undefined;
  const selectedHoursPerson = selectedHoursMonth
    ? people.find(
        (resource) =>
          resource.id === selectedCell?.resourceId &&
          eligible.has(resource.id + "|" + selectedHoursMonth),
      )
    : undefined;
  function selectHoursContext(resourceId: string, month: string, key: string) {
    if (month > currentMonth || !eligible.has(resourceId + "|" + month)) return;
    setSelectedCell((previous) =>
      previous?.key === key ? previous : { key, resourceId, month },
    );
  }
  return {
    selectedCell,
    selectedHoursMonth,
    selectedHoursPerson,
    selectHoursContext,
    clearSelection: () => setSelectedCell(null),
  };
}
