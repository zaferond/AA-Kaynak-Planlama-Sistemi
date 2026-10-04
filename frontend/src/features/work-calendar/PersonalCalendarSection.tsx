import { Plus, Trash2 } from "lucide-react";
import {
  MIN_PLANNING_DATE,
  MAX_PLANNING_DATE,
} from "../../../../shared/planning-dates";
import { PERSONAL_HOURS_STEP } from "../../calendar-rules";
import { HOURS_PER_WORKDAY } from "../../actual-units";
import type { PersonalCalendarForm } from "./types";
import type { WorkCalendarEditor } from "./useWorkCalendarEditor";
import type { WorkCalendarView } from "./useWorkCalendarView";
import { dateFormat } from "./format";

export default function PersonalCalendarSection({
  form,
  update,
  entries: personalEntries,
  canEdit,
  busy,
  savePersonal,
  removePersonal,
}: {
  form: PersonalCalendarForm;
  update: WorkCalendarEditor["updatePersonal"];
  entries: WorkCalendarView["personalEntries"];
  canEdit: boolean;
  busy: boolean;
  savePersonal: () => Promise<void>;
  removePersonal: (id: string) => Promise<void>;
}) {
  const {
    date: personalDate,
    type: personalType,
    hours: personalHours,
    label: personalLabel,
  } = form;
  return (
    <section className="work-calendar-personal">
      <h3>İzin ve Eğitim Kayıtları</h3>
      {canEdit && (
        <div className="work-calendar-fields">
          <label>
            Tarih
            <input
              disabled={busy}
              type="date"
              min={MIN_PLANNING_DATE}
              max={MAX_PLANNING_DATE}
              value={personalDate}
              onChange={(event) => update("date", event.target.value)}
            />
          </label>
          <label>
            Tür
            <select
              disabled={busy}
              value={personalType}
              onChange={(event) =>
                update("type", event.target.value as "leave" | "training")
              }
            >
              <option value="leave">İzin</option>
              <option value="training">Eğitim</option>
            </select>
          </label>
          <label>
            Saat
            <input
              disabled={busy}
              type="number"
              min={PERSONAL_HOURS_STEP}
              max={HOURS_PER_WORKDAY}
              step={PERSONAL_HOURS_STEP}
              value={personalHours}
              onChange={(event) => update("hours", event.target.value)}
            />
          </label>
          <label className="work-calendar-label">
            Açıklama
            <input
              disabled={busy}
              maxLength={100}
              value={personalLabel}
              onChange={(event) => update("label", event.target.value)}
              placeholder="İsteğe bağlı"
            />
          </label>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void savePersonal()}
          >
            <Plus size={14} />
            Kaydet
          </button>
        </div>
      )}
      <p className="work-calendar-help">
        Aynı tarihe izin ve eğitim ayrı ayrı girilebilir; günlük toplam en fazla{" "}
        {HOURS_PER_WORKDAY} saattir. İzin çalışılabilir aylık saatten düşer;
        eğitim bu saatin içinde kalır ve dağıtılan kaynak yüzdesine eklenir.
        Hafta sonu veya ortak tatilde saat ikinci kez sayılmaz.
      </p>
      <div className="work-calendar-list">
        {personalEntries.length ? (
          <ul>
            {personalEntries.map(([key, item]) => {
              const date = key.split("|")[1];
              return (
                <li key={key}>
                  <time dateTime={date}>
                    {dateFormat.format(new Date(date + "T12:00:00"))}
                  </time>
                  <span>
                    <strong>{item.type === "leave" ? "İzin" : "Eğitim"}</strong>
                    {item.label ? " · " + item.label : ""}
                    <small>{item.hours.toLocaleString("tr-TR")} saat</small>
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={date + " kaydını kaldır"}
                      title="Kaydı kaldır"
                      onClick={() => void removePersonal(key)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Bu yıl için izin veya eğitim kaydı yok.</p>
        )}
      </div>
    </section>
  );
}
