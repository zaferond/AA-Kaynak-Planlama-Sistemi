import {
  MIN_PLANNING_YEAR,
  MAX_PLANNING_YEAR,
  MIN_PLANNING_DATE,
  MAX_PLANNING_DATE,
} from "../../shared/planning-dates";
import { PERSONAL_HOURS_STEP } from "./calendar-rules";
import {
  CALENDAR_DAY_TYPES as types,
  addCalendarDates,
  prepareCalendarChange,
  preparePersonalDayChange,
  preparePersonalDayRemoval,
  startCalendarDraft,
  type CalendarDraft,
} from "./features/calendar-commands";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Data, Resource } from "./model";
import type { CalendarDay, WorkCalendar } from "./actual-units";
import {
  calendarHoursInMonth,
  personCalendarHoursInMonth,
  HOURS_PER_WORKDAY,
  workdaysInMonth,
} from "./actual-units";
import { writeBatch } from "./storage";

const monthFormat = new Intl.DateTimeFormat("tr-TR", { month: "long" });
const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const emptyCalendar: WorkCalendar = {};

export default function WorkCalendarDialog({
  open,
  onOpenChange,
  data,
  mode,
  resource,
  canEdit,
  canEditPersonal,
  onSaved,
  initialYear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Data;
  mode: "shared" | "personal";
  resource: Resource | null;
  canEdit: boolean;
  canEditPersonal: boolean;
  onSaved: (data: Data) => void;
  initialYear: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [calendarDraft, setCalendarDraft] = useState<CalendarDraft | null>(
    null,
  );
  const draft =
    mode === "personal"
      ? data.workCalendar || emptyCalendar
      : calendarDraft?.calendar || emptyCalendar;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<CalendarDay["type"]>("official");
  const [label, setLabel] = useState("");
  const [fraction, setFraction] = useState<0.5 | 1>(1);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [personalDate, setPersonalDate] = useState("");
  const [personalType, setPersonalType] = useState<"leave" | "training">(
    "leave",
  );
  const [personalHours, setPersonalHours] = useState(String(HOURS_PER_WORKDAY));
  const [personalLabel, setPersonalLabel] = useState("");
  // Capture an opening snapshot; background refreshes must not replace an unsaved shared draft.
  useEffect(() => {
    if (open) {
      setCalendarDraft(startCalendarDraft(data));
      setYear(initialYear);
      setDirty(false);
      setError("");
      setFrom("");
      setTo("");
      setPersonalDate("");
      setPersonalHours(String(HOURS_PER_WORKDAY));
      setPersonalLabel("");
    }
  }, [open, initialYear, resource?.id, mode]);
  const entries = useMemo(
    () =>
      Object.entries(draft)
        .filter(([date]) => date.startsWith(String(year) + "-"))
        .sort(([a], [b]) => a.localeCompare(b)),
    [draft, year],
  );
  const personalEntries = Object.entries(data.personCalendar || {})
    .filter(
      ([key]) => resource && key.startsWith(resource.id + "|" + year + "-"),
    )
    .sort(([a], [b]) => a.localeCompare(b));
  const monthRows = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = year + "-" + String(index + 1).padStart(2, "0");
        const weekdays = workdaysInMonth(month),
          hours = calendarHoursInMonth(month, draft);
        return {
          month,
          label: monthFormat.format(new Date(month + "-01T12:00:00")),
          weekdays,
          excluded: weekdays - hours / HOURS_PER_WORKDAY,
          hours,
        };
      }),
    [draft, year],
  );
  function addDates() {
    setError("");
    if (!calendarDraft || !canEdit || busy) return;
    try {
      setCalendarDraft(
        addCalendarDates(calendarDraft, { from, to, type, label, fraction }),
      );
      setDirty(true);
      setYear(Number(from.slice(0, 4)));
      setLabel("");
      setFrom("");
      setTo("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function save() {
    if (!canEdit || busy || !dirty || !calendarDraft) return;
    setBusy(true);
    setError("");
    try {
      const next = await writeBatch([prepareCalendarChange(calendarDraft)]);
      onSaved(next);
      onOpenChange(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function savePersonal() {
    if (!resource || !canEditPersonal || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await writeBatch([
        preparePersonalDayChange(data, resource.id, {
          date: personalDate,
          type: personalType,
          hours: personalHours,
          label: personalLabel,
        }),
      ]);
      onSaved(next);
      setYear(Number(personalDate.slice(0, 4)));
      setPersonalDate("");
      setPersonalLabel("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removePersonal(id: string) {
    if (!resource || !canEditPersonal || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await writeBatch([
        preparePersonalDayRemoval(data, resource.id, id),
      ]);
      onSaved(next);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="work-calendar-dialog">
        <DialogHeader>
          <DialogTitle>
            <CalendarDays size={18} />{" "}
            {mode === "shared"
              ? "Çalışma Takvimi"
              : resource?.name + " · İzin ve Eğitim Takvimi"}
          </DialogTitle>
          <DialogDescription>
            {mode === "shared"
              ? "Resmî tatil, bayram ve Otokar çalışma dışı günlerini burada tanımlayın. Kaydedilen tarihler tüm çalışanların aylık saat hesabına uygulanır."
              : "Seçili çalışanın izin ve eğitim günlerini tam gün veya saatlik olarak girin. Ortak tatiller bu hesapta otomatik dikkate alınır."}
          </DialogDescription>
        </DialogHeader>
        <div className="work-calendar-body">
          <div className="work-calendar-year">
            <button
              type="button"
              disabled={year <= MIN_PLANNING_YEAR}
              onClick={() => setYear(year - 1)}
            >
              ‹
            </button>
            <strong>{year}</strong>
            <button
              type="button"
              disabled={year >= MAX_PLANNING_YEAR}
              onClick={() => setYear(year + 1)}
            >
              ›
            </button>
            <span>
              {mode === "shared" ? entries.length : personalEntries.length}{" "}
              kayıt
            </span>
          </div>
          {mode === "personal" && resource && (
            <section className="work-calendar-personal">
              <h3>İzin ve Eğitim Kayıtları</h3>
              {canEditPersonal && (
                <div className="work-calendar-fields">
                  <label>
                    Tarih
                    <input
                      type="date"
                      min={MIN_PLANNING_DATE}
                      max={MAX_PLANNING_DATE}
                      value={personalDate}
                      onChange={(event) => setPersonalDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Tür
                    <select
                      value={personalType}
                      onChange={(event) =>
                        setPersonalType(
                          event.target.value as "leave" | "training",
                        )
                      }
                    >
                      <option value="leave">İzin</option>
                      <option value="training">Eğitim</option>
                    </select>
                  </label>
                  <label>
                    Saat
                    <input
                      type="number"
                      min={PERSONAL_HOURS_STEP}
                      max={HOURS_PER_WORKDAY}
                      step={PERSONAL_HOURS_STEP}
                      value={personalHours}
                      onChange={(event) => setPersonalHours(event.target.value)}
                    />
                  </label>
                  <label className="work-calendar-label">
                    Açıklama
                    <input
                      maxLength={100}
                      value={personalLabel}
                      onChange={(event) => setPersonalLabel(event.target.value)}
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
                Aynı tarihe izin ve eğitim ayrı ayrı girilebilir; günlük toplam
                en fazla {HOURS_PER_WORKDAY} saattir. İzin çalışılabilir aylık
                saatten düşer; eğitim bu saatin içinde kalır ve dağıtılan kaynak
                yüzdesine eklenir. Hafta sonu veya ortak tatilde saat ikinci kez
                sayılmaz.
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
                            <strong>
                              {item.type === "leave" ? "İzin" : "Eğitim"}
                            </strong>
                            {item.label ? " · " + item.label : ""}
                            <small>
                              {item.hours.toLocaleString("tr-TR")} saat
                            </small>
                          </span>
                          {canEditPersonal && (
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
          )}
          {mode === "shared" && canEdit && (
            <div className="work-calendar-form">
              <div className="work-calendar-form-title">
                Çalışma dışı tarih ekle
              </div>
              <div className="work-calendar-fields">
                <label>
                  Başlangıç
                  <input
                    type="date"
                    min={MIN_PLANNING_DATE}
                    max={MAX_PLANNING_DATE}
                    value={from}
                    onChange={(event) => {
                      setFrom(event.target.value);
                      if (!to) setTo(event.target.value);
                    }}
                  />
                </label>
                <label>
                  Bitiş
                  <input
                    type="date"
                    min={from || MIN_PLANNING_DATE}
                    max={MAX_PLANNING_DATE}
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </label>
                <label>
                  Tür
                  <select
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as CalendarDay["type"])
                    }
                  >
                    {types.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Süre
                  <select
                    value={fraction}
                    onChange={(event) =>
                      setFraction(Number(event.target.value) as 0.5 | 1)
                    }
                  >
                    <option value={1}>Tam gün</option>
                    <option value={0.5}>Yarım gün</option>
                  </select>
                </label>
                <label className="work-calendar-label">
                  Açıklama
                  <input
                    value={label}
                    maxLength={100}
                    placeholder={types.find((item) => item.id === type)?.label}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="button primary"
                  onClick={addDates}
                >
                  <Plus size={14} />
                  Ekle
                </button>
              </div>
            </div>
          )}
          {mode === "shared" && (
            <div className="work-calendar-list">
              <h3>Çalışma Dışı Tarihler</h3>
              {entries.length ? (
                <ul>
                  {entries.map(([date, item]) => (
                    <li key={date}>
                      <time dateTime={date}>
                        {dateFormat.format(new Date(date + "T12:00:00"))}
                      </time>
                      <span>
                        {item.label}
                        <small>
                          {types.find((type) => type.id === item.type)?.label} ·{" "}
                          {item.fraction === 0.5 ? "Yarım gün" : "Tam gün"}
                        </small>
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={date + " tarihini kaldır"}
                          title="Tarihi kaldır"
                          onClick={() => {
                            const next = { ...draft };
                            delete next[date];
                            setCalendarDraft(
                              (current) =>
                                current && { ...current, calendar: next },
                            );
                            setDirty(true);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Bu yıl için çalışma dışı tarih eklenmedi.</p>
              )}
            </div>
          )}
          <div className="work-calendar-summary">
            <h3>Aylık Çalışma Saatleri</h3>
            <div className="work-calendar-months">
              {monthRows.map((row) => {
                const personal =
                  resource && mode === "personal"
                    ? personCalendarHoursInMonth(
                        row.month,
                        resource.id,
                        draft,
                        data.personCalendar,
                      )
                    : null;
                return (
                  <div key={row.month}>
                    <strong>{row.label}</strong>
                    <span>
                      {personal
                        ? "İzin " +
                          personal.leaveHours.toLocaleString("tr-TR") +
                          " sa · Eğitim " +
                          personal.trainingHours.toLocaleString("tr-TR") +
                          " sa"
                        : row.weekdays +
                          " hafta içi − " +
                          row.excluded.toLocaleString("tr-TR", {
                            maximumFractionDigits: 1,
                          }) +
                          " ortak tatil günü"}
                    </span>
                    <b>
                      {(personal
                        ? personal.baseHours - personal.leaveHours
                        : row.hours
                      ).toLocaleString("tr-TR", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      saat
                    </b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="work-calendar-error">
            {error}
          </p>
        )}
        <div className="work-calendar-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Kapat
          </button>
          {mode === "shared" && canEdit && (
            <button
              type="button"
              className="button primary"
              disabled={busy || !dirty}
              onClick={() => void save()}
            >
              {busy ? "Kaydediliyor…" : "Takvimi Kaydet"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
