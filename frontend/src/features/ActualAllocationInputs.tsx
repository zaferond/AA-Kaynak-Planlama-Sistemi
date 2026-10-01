import { useEffect, useRef, useState } from "react";
import type { Resource } from "../../../shared/model.ts";
import type { ActualUnit } from "../../../shared/actual-units.ts";
import {
  checkActualEntry,
  parseWorkedHoursInput,
  formatActualEntry as formatEntry,
} from "./actual-allocation-commands";

const unitLabels: Record<ActualUnit, string> = {
  percent: "%",
  days: "gün",
  hours: "saat",
};
export function WorkedHours({
  value,
  calculatedHours,
  maxHours,
  resource,
  month,
  disabled,
  onSave,
}: {
  value?: number;
  calculatedHours: number;
  maxHours: number;
  resource: Resource;
  month: string;
  disabled: boolean;
  onSave: (
    hours: number | null,
    input: HTMLInputElement | null,
  ) => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(
    String(value ?? calculatedHours).replace(".", ","),
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setText(String(value ?? calculatedHours).replace(".", ","));
    setDirty(false);
    setError("");
  }, [value, calculatedHours, resource.id, month]);
  async function commit() {
    if (disabled || busy || !dirty) return;
    setBusy(true);
    try {
      const hours = parseWorkedHoursInput(text, maxHours);
      const saved = await onSave(hours, inputRef.current);
      if (!saved) setText(String(value ?? calculatedHours).replace(".", ","));
      setDirty(false);
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="worked-hours-input">
      <input
        ref={inputRef}
        aria-label={resource.name + " / " + month + " çalışılan saat"}
        inputMode="decimal"
        value={text}
        disabled={disabled || busy}
        placeholder={String(calculatedHours)}
        title={
          "Otomatik hesap: " +
          calculatedHours +
          " saat. Alanı boşaltırsanız otomatik hesap kullanılır."
        }
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setText(event.target.value);
          setDirty(true);
          setError("");
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.blur();
          }
        }}
      />
      {error && <small role="alert">{error}</small>}
    </span>
  );
}

export function ActualAmount({
  value,
  disabled,
  onSave,
  label,
  month,
  unit,
  workedHours,
  savedPercent,
  otherAllocated,
  fullyAllocated,
  onLimitExceeded,
  onDeselect,
}: {
  value: number;
  disabled: boolean;
  onSave: (entry: { unit: ActualUnit; value: number }) => Promise<void>;
  label: string;
  month: string;
  unit: ActualUnit;
  workedHours?: number;
  savedPercent?: number;
  otherAllocated: number;
  fullyAllocated: boolean;
  onLimitExceeded: (input: HTMLInputElement | null) => void;
  onDeselect: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() =>
    formatEntry(value, unit, month, workedHours, savedPercent),
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setText(formatEntry(value, unit, month, workedHours, savedPercent));
    setDirty(false);
    setError("");
  }, [value, unit, month, workedHours, savedPercent]);
  function showLimitWarning() {
    setText(formatEntry(value, unit, month, workedHours, savedPercent));
    setDirty(false);
    setError("");
    onLimitExceeded(inputRef.current);
  }
  async function commit() {
    if (disabled || busy || !dirty) return;
    const checked = checkActualEntry(
      text,
      unit,
      month,
      workedHours,
      otherAllocated,
    );
    if (checked.kind === "invalid") {
      setError(checked.message);
      return;
    }
    if (checked.kind === "limit") {
      showLimitWarning();
      return;
    }
    setBusy(true);
    try {
      await onSave(checked.entry);
      setDirty(false);
      setError("");
    } catch (cause) {
      const message = (cause as Error).message;
      if (message.includes("%100")) showLimitWarning();
      else setError(message);
    } finally {
      setBusy(false);
    }
  }
  if (fullyAllocated && !disabled && value === 0)
    return (
      <div
        className="actual-fully-allocated"
        role="status"
        title={
          label + " · kişinin aylık kaynağının tamamı diğer projelere dağıtıldı"
        }
        aria-label="Tüm kaynak dağıtıldı"
      >
        ✓ Dolu
      </div>
    );
  return (
    <div className="person-amount">
      <input
        ref={inputRef}
        aria-label={label + " / " + unitLabels[unit]}
        title={error || label + " / " + unitLabels[unit]}
        inputMode="decimal"
        value={unit === "percent" && text ? "%" + text : text}
        disabled={disabled || busy}
        placeholder={unit === "percent" ? "%" : "0"}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setText(
            unit === "percent"
              ? event.target.value.replaceAll("%", "")
              : event.target.value,
          );
          setDirty(true);
          setError("");
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.blur();
            onDeselect();
          }
        }}
      />
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
