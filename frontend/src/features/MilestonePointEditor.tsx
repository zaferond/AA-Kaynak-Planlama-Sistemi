import type { Milestone } from "../model";
import { phasePalette } from "../model";
import { fullDateLabel } from "../format";
type Props = {
  value: Milestone;
  projectStart: string;
  projectEnd: string;
  onChange: (value: Milestone) => void;
};
export default function MilestonePointEditor({
  value,
  projectStart,
  projectEnd,
  onChange,
}: Props) {
  const lastDay = new Date(
    Date.UTC(Number(projectEnd.slice(0, 4)), Number(projectEnd.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const color =
    phasePalette.find((item) => item.id === value.barColor) || phasePalette[3];
  return (
    <div className="milestone-point-editor">
      <label>
        Milestone Tarihi
        <input
          type="date"
          value={value.start}
          min={projectStart + "-01"}
          max={lastDay}
          onChange={(event) =>
            onChange({
              ...value,
              start: event.target.value,
              end: event.target.value,
            })
          }
        />
      </label>
      <fieldset>
        <legend>Milestone Rengi</legend>
        <div className="milestone-point-colors">
          {phasePalette.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-label={item.name}
              title={item.name}
              aria-pressed={value.barColor === item.id}
              className={value.barColor === item.id ? "selected" : ""}
              onClick={() => onChange({ ...value, barColor: item.id })}
            >
              <span
                className="milestone-diamond"
                style={{ background: item.border }}
              />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="milestone-point-preview">
        <span
          className="milestone-diamond"
          style={{ background: color.border }}
        />
        <div>
          <strong>{value.name || "Milestone"}</strong>
          <small>{fullDateLabel(value.start)}</small>
        </div>
      </div>
      <small>
        Tek tarihli Milestone, proje takviminde baklava olarak gösterilir.
        Basılı tutup sürükleyerek tarihini değiştirebilirsiniz.
      </small>
    </div>
  );
}
