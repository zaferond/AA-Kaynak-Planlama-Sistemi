import { useState, useRef, useEffect } from "react";
export default function Cell({
  value,
  save,
  label,
  disabled = false,
  onFillSelection,
}: {
  value: number;
  save: (v: number) => Promise<void>;
  label: string;
  disabled?: boolean;
  onFillSelection?: (v: number) => Promise<void>;
}) {
  const [text, setText] = useState(
      value ? String(value).replace(".", ",") : "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const skipBlur = useRef(false);
  useEffect(() => {
    setText(value ? String(value).replace(".", ",") : "");
  }, [value]);
  async function commit() {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      setError("Pozitif sayı veya sıfır girin.");
      return;
    }
    if (n === value) return;
    setBusy(true);
    try {
      await save(n);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function fillSelection() {
    if (!onFillSelection) return;
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 10000) {
      setError("0–10.000 aralığında bir değer girin.");
      return;
    }
    setBusy(true);
    try {
      await onFillSelection(n);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={"cell " + (error ? "invalid" : "")}>
      <input
        aria-label={label}
        title={
          error ||
          label +
            " : " +
            (text || "0") +
            (onFillSelection ? " · Ctrl+Enter: seçili hücrelere uygula" : "")
        }
        onFocus={(e) => e.currentTarget.select()}
        inputMode="decimal"
        value={text}
        disabled={disabled || busy}
        placeholder={disabled ? "—" : "0"}
        onChange={(e) => {
          delete e.currentTarget.dataset.gridSelectionFocus;
          setText(e.target.value);
        }}
        onBlur={() => {
          if (skipBlur.current) {
            skipBlur.current = false;
            return;
          }
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            skipBlur.current = true;
            setText(value ? String(value).replace(".", ",") : "");
            e.currentTarget.blur();
            return;
          }
          if (
            e.key === "Enter" &&
            (e.ctrlKey || e.metaKey) &&
            onFillSelection
          ) {
            e.preventDefault();
            e.stopPropagation();
            skipBlur.current = true;
            e.currentTarget.blur();
            void fillSelection();
            return;
          }
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
