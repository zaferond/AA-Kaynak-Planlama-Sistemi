import { useEffect, type RefObject } from "react";
export function useSynchronizedTableScroll({
  enabled,
  primaryRef,
  secondaryRef,
  layoutKey,
}: {
  enabled: boolean;
  primaryRef: RefObject<HTMLTableElement | null>;
  secondaryRef: RefObject<HTMLTableElement | null>;
  layoutKey: string;
}) {
  useEffect(() => {
    if (!enabled) return;
    const primary = primaryRef.current?.parentElement,
      secondary = secondaryRef.current?.parentElement;
    if (!primary || !secondary) return;
    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (Math.abs(target.scrollLeft - source.scrollLeft) > 0.5)
        target.scrollLeft = source.scrollLeft;
    };
    const fromPrimary = () => sync(primary, secondary),
      fromSecondary = () => sync(secondary, primary);
    secondary.scrollLeft = primary.scrollLeft;
    primary.addEventListener("scroll", fromPrimary);
    secondary.addEventListener("scroll", fromSecondary);
    return () => {
      primary.removeEventListener("scroll", fromPrimary);
      secondary.removeEventListener("scroll", fromSecondary);
    };
  }, [enabled, primaryRef, secondaryRef, layoutKey]);
}
