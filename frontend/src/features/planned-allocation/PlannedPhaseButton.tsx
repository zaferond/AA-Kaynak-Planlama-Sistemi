import type { Project } from "../../model";
import { phaseStyle } from "../../model";
import { monthLabel } from "../../format";
import type { PlannedAllocationProps } from "./types";
function phaseText(p: Project, m: string) {
  return m < p.start || m > p.end
    ? "Proje dönemi dışında"
    : p.phases[m] || "Çalışma bilgisi girilmemiş";
}
export default function PlannedPhaseButton({
  project: p,
  month: m,
  density,
  onPhaseClick,
  onPhaseContextMenu,
}: Pick<
  PlannedAllocationProps,
  "density" | "onPhaseClick" | "onPhaseContextMenu"
> & { project: Project; month: string }) {
  const text = phaseText(p, m);
  return (
    <button
      className="month-work"
      style={phaseStyle(p, m)}
      title={p.name + " / " + monthLabel(m) + "\n" + text}
      aria-label={p.name + " / " + monthLabel(m) + " planlanan çalışma"}
      onContextMenu={(e) => onPhaseContextMenu(e, p, m)}
      onClick={() => onPhaseClick(p, m)}
      disabled={m < p.start || m > p.end}
    >
      <span className="phasepreview">
        {density === "overview" ? (p.phases[m] ? "●" : "·") : text}
      </span>
    </button>
  );
}
