import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type WindowedSection = {
  key: string;
  height: number;
  render: () => ReactNode;
};

/** Keeps the full scroll extent while mounting only nearby table sections. */
export function useWindowedSections(
  tableRef: RefObject<HTMLTableElement | null>,
  sections: WindowedSection[],
  columns: number,
  layoutKey: string,
) {
  const measured = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);
  const [viewport, setViewport] = useState({
    top: 0,
    height: 1000,
    held: [] as string[],
  });
  const identity = JSON.stringify([
    sections.map((section) => section.key),
    layoutKey,
  ]);
  useLayoutEffect(() => {
    measured.current.clear();
    const container = tableRef.current?.parentElement;
    if (container) container.scrollTop = 0;
    setViewport({ top: 0, height: container?.clientHeight || 1000, held: [] });
    setVersion((n) => n + 1);
  }, [identity, tableRef]);
  useLayoutEffect(() => {
    const table = tableRef.current;
    const container = table?.parentElement;
    if (!table || !container) return;
    let frame = 0,
      held = "";
    const update = () => {
      frame = 0;
      const focused = document.activeElement?.closest<HTMLElement>(
        "tbody[data-window-key]",
      );
      setViewport({
        top: container.scrollTop,
        height: container.clientHeight,
        held: [
          ...new Set(
            [
              held,
              focused?.dataset.windowKey || "",
              ...Array.from(
                table.querySelectorAll('[data-window-keep="true"]'),
              ).map(
                (cell) =>
                  cell.closest<HTMLElement>("tbody[data-window-key]")?.dataset
                    .windowKey || "",
              ),
            ].filter(Boolean),
          ),
        ],
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const hold = (event: PointerEvent) => {
      held =
        (event.target as HTMLElement)?.closest<HTMLElement>(
          "tbody[data-window-key]",
        )?.dataset.windowKey || "";
      schedule();
    };
    const release = () => {
      held = "";
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    container.addEventListener("scroll", schedule, { passive: true });
    container.addEventListener("pointerdown", hold);
    container.addEventListener("focusin", schedule);
    container.addEventListener("focusout", schedule);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener("scroll", schedule);
      container.removeEventListener("pointerdown", hold);
      container.removeEventListener("focusin", schedule);
      container.removeEventListener("focusout", schedule);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [tableRef, identity]);
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const update = () => {
      let changed = false;
      for (const body of table.querySelectorAll<HTMLTableSectionElement>(
        "tbody[data-window-key]",
      )) {
        const key = body.dataset.windowKey!;
        const height = body.offsetHeight;
        if (height > 0 && measured.current.get(key) !== height) {
          measured.current.set(key, height);
          changed = true;
        }
      }
      if (changed) setVersion((n) => n + 1);
    };
    update();
    const observer = new ResizeObserver(update);
    for (const body of table.querySelectorAll("tbody[data-window-key]"))
      observer.observe(body);
    return () => observer.disconnect();
  });
  return useMemo(() => {
    let position = tableRef.current?.querySelector("thead")?.offsetHeight || 0;
    let gap = 0;
    const output: ReactNode[] = [];
    const flush = (key: string) => {
      if (!gap) return;
      output.push(
        <tbody
          key={"gap-" + key}
          className="windowed-table-spacer"
          aria-hidden="true"
        >
          <tr>
            <td colSpan={columns} style={{ height: gap }} />
          </tr>
        </tbody>,
      );
      gap = 0;
    };
    for (const section of sections) {
      const height = measured.current.get(section.key) || section.height;
      const visible =
        sections.length <= 10 ||
        viewport.held.includes(section.key) ||
        (position + height >= viewport.top - 800 &&
          position <= viewport.top + viewport.height + 800);
      if (visible) {
        flush(section.key);
        output.push(section.render());
      } else gap += height;
      position += height;
    }
    flush("end");
    return output;
  }, [sections, columns, viewport, version, tableRef]);
}
