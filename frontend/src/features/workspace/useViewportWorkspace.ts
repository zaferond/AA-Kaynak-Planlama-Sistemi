import { useLayoutEffect, useRef } from "react";

/** Size the table relative to its available viewport, keeping panel controls fixed.
 * Larger multipliers extend page scrolling; wheel/key events are not intercepted.
 */
export function useViewportWorkspace(tableHeightMultiplier = 1) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    const app = panel?.closest<HTMLElement>(".app");
    if (!panel || !app) return;
    const table = panel.querySelector<HTMLElement>(
      ':scope > [data-slot="table-container"]',
    );
    let frame = 0;
    const update = () => {
      const zoom =
        Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const tail = Math.max(
        0,
        app.getBoundingClientRect().bottom -
          panel.getBoundingClientRect().bottom,
      );
      const baseHeight = Math.max(1, (window.innerHeight - tail) / zoom);
      const controlsHeight = table
        ? panel.offsetHeight - table.offsetHeight
        : 0;
      const baseTableHeight = Math.max(0, baseHeight - controlsHeight);
      const height = baseHeight + (tableHeightMultiplier - 1) * baseTableHeight;
      const value = height.toFixed(2) + "px";
      if (panel.style.getPropertyValue("--workspace-height") !== value)
        panel.style.setProperty("--workspace-height", value);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    if (table) observer.observe(table);
    observer.observe(app);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [tableHeightMultiplier]);
  return ref;
}
