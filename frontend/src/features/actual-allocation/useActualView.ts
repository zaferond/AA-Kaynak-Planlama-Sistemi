import { useEffect, useState } from "react";
import { readActualView, type ActualViewSnapshot } from "../../storage";
/** Discard responses from a different snapshot, period or session. */
export function useActualView(
  enabled: boolean,
  source: unknown,
  start: string,
  count: number,
  currentMonth: string,
) {
  const [retry, setRetry] = useState(0);
  const key = start + ":" + count + ":" + currentMonth + ":" + retry;
  const [result, setResult] = useState<{
    key: string;
    source: unknown;
    value?: ActualViewSnapshot;
    error?: string;
  }>();
  useEffect(() => {
    if (!enabled) {
      setResult(undefined);
      return;
    }
    let cancelled = false;
    void readActualView(start, count)
      .then((value) => {
        if (!cancelled) setResult({ key, source, value });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({ key, source, error: (error as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, source, key]);
  const current =
    enabled && result?.key === key && result.source === source
      ? result
      : undefined;
  return {
    value: current?.value,
    error: current?.error,
    busy: enabled && !current,
    reload: () => setRetry((n) => n + 1),
  };
}
