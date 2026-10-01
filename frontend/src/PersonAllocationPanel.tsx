import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Data, Project, Resource, Team } from "./model";
import { visibleActualVersion, phaseStyle } from "./model";
import { writeLocal } from "./storage";
import { groupPage } from "./metrics";
import Pager from "./Pager";
import ProjectResponsible from "./ProjectResponsible";
import WorkCalendarDialog from "./WorkCalendarDialog";
import { CalendarDays } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  actualInputToFte,
  fteToActualInput,
  personCalendarHoursInMonth,
  workdaysInMonth,
  HOURS_PER_WORKDAY,
  DEFAULT_MONTHLY_HOURS,
} from "./actual-units";
import type { ActualUnit } from "./actual-units";

const numberFormat = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});
const fullMonthFormat = new Intl.DateTimeFormat("tr-TR", { month: "long" });
const limitMessage =
  "Girdiğiniz değer kişinin çalışma süresinin %100'ünü aşılmasına neden olmaktadır. Lütfen çalışma süresini tekrar değerlendirerek düşürünüz.";
const hoursLimitMessage =
  "Girdiğiniz yeni aylık çalışma saati kaydedilemez. Mevcut proje dağılımları yeni girilen çalışma saatinin %100'ünü aşmaktadır. Yeni girmek istediğiniz çalışma saatine güncellenebilmesi için öncelikle kaynak dağılımını azaltmanız, sonrasında çalışma saatini güncellemeniz gerekmektedir.";

const unitLabels: Record<ActualUnit, string> = {
  percent: "%",
  days: "gün",
  hours: "saat",
};
function formatEntry(
  value: number,
  unit: ActualUnit,
  month: string,
  workedHours?: number,
  savedPercent?: number,
): string {
  const input =
    unit === "percent" && savedPercent !== undefined
      ? savedPercent
      : fteToActualInput(value, unit, month, workedHours);
  if (!input) return "";
  return String(Math.round(input * 100) / 100).replace(".", ",");
}

function WorkedHours({
  value,
  calculatedHours,
  resource,
  month,
  disabled,
  onSave,
}: {
  value?: number;
  calculatedHours: number;
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
    const hours =
      text.trim() === "" ? null : Number(text.trim().replace(",", "."));
    if (
      hours !== null &&
      (!Number.isFinite(hours) || hours < 0 || hours > 1000)
    ) {
      setError("0–1000 saat arasında bir değer girin.");
      return;
    }
    setBusy(true);
    try {
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

function Amount({
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
    const raw = text.trim() === "" ? 0 : Number(text.trim().replace(",", "."));
    if (!Number.isFinite(raw) || raw < 0) {
      setError("Sıfır veya pozitif bir sayı girin.");
      return;
    }
    if (unit === "percent" && raw > 100) {
      showLimitWarning();
      return;
    }
    const amount = actualInputToFte(raw, unit, month, workedHours);
    if (!Number.isFinite(amount) || amount > 100) {
      showLimitWarning();
      return;
    }
    const monthlyLimit = actualInputToFte(100, "percent", month, workedHours);
    if (otherAllocated + amount > monthlyLimit + 1e-9) {
      showLimitWarning();
      return;
    }
    setBusy(true);
    try {
      await onSave({ unit, value: raw });
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

export default function PersonAllocationPanel({
  data,
  teams,
  projects,
  months,
  currentMonth,
  todayDate,
  selectedPersonIds,
  canEditCalendar,
  ownResourceId,
  onSaved,
}: {
  data: Data;
  teams: Team[];
  projects: Project[];
  months: string[];
  currentMonth: string;
  todayDate: string;
  selectedPersonIds: string[];
  canEditCalendar: boolean;
  ownResourceId?: string;
  onSaved: (data: Data) => void;
}) {
  const monthWidth = 76;
  const [unit, setUnit] = useState<ActualUnit>("percent");
  const [selectedCell, setSelectedCell] = useState<{
    key: string;
    resourceId: string;
    month: string;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [phaseDetail, setPhaseDetail] = useState<{
    project: Project;
    month: string;
  } | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [calendarPerson, setCalendarPerson] = useState<Resource | null>(null);
  const [calendarMode, setCalendarMode] = useState<
    "shared" | "personal" | null
  >(null);
  const [limitKind, setLimitKind] = useState<"allocation" | "hours">(
    "allocation",
  );
  const limitReturnInput = useRef<HTMLInputElement | null>(null);
  const limitOpenRef = useRef(false);
  function openLimit(
    kind: "allocation" | "hours",
    input: HTMLInputElement | null,
  ) {
    limitReturnInput.current = input;
    limitOpenRef.current = true;
    setLimitKind(kind);
    setLimitOpen(true);
  }
  function closeLimit() {
    limitOpenRef.current = false;
    setLimitOpen(false);
  }
  const teamKey = teams.map((team) => team.id).join("|");
  const monthKey = months.join("|");
  const teamIds = useMemo(
    () => new Set(teams.map((team) => team.id)),
    [teamKey],
  );
  const eligible = useMemo(() => {
    const cells = new Set<string>();
    for (const resource of data.resources)
      for (const month of months) {
        if (month > currentMonth) continue;
        const version = visibleActualVersion(resource, month, currentMonth);
        if (version && teamIds.has(version.team))
          cells.add(resource.id + "|" + month);
      }
    return cells;
  }, [data.resources, monthKey, teamIds, currentMonth]);
  const selected = new Set(selectedPersonIds);
  const people = data.resources
    .filter(
      (resource) =>
        months.some((month) => eligible.has(resource.id + "|" + month)) &&
        (!selected.size || selected.has(resource.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const scopeKey =
    projects.map((project) => project.id).join("|") +
    ";" +
    people.map((person) => person.id).join("|") +
    ";" +
    monthKey;
  useEffect(() => {
    setPage(0);
    setSelectedCell(null);
  }, [scopeKey]);
  useEffect(() => {
    const withinSelection = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest(
        '.person-allocation [data-actual-context-cell="true"], .person-allocation .actual-unit-control, .actual-limit-dialog',
      );
    const clearOutside = (event: Event) => {
      if (!limitOpenRef.current && !withinSelection(event.target))
        setSelectedCell(null);
    };
    const clearOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCell(null);
    };
    document.addEventListener("click", clearOutside);
    document.addEventListener("focusin", clearOutside);
    document.addEventListener("keydown", clearOnEscape);
    return () => {
      document.removeEventListener("click", clearOutside);
      document.removeEventListener("focusin", clearOutside);
      document.removeEventListener("keydown", clearOnEscape);
    };
  }, []);
  const pageSize = Math.max(
    20,
    Math.min(100, Math.floor(1200 / months.length)),
  );
  const totalRows = projects.length * Math.max(people.length, 1);
  const visiblePage = Math.min(
    page,
    Math.max(0, Math.ceil(totalRows / pageSize) - 1),
  );
  const groups = groupPage(
    projects.length,
    Math.max(people.length, 1),
    visiblePage,
    pageSize,
  );
  useEffect(() => setSelectedCell(null), [visiblePage]);
  const personMonthTotals: Record<string, number> = {};
  const calendarTotalsCache = new Map<
    string,
    ReturnType<typeof personCalendarHoursInMonth>
  >();
  const calendarTotals = (resourceId: string, month: string) => {
    const key = resourceId + "|" + month;
    let totals = calendarTotalsCache.get(key);
    if (!totals) {
      totals = personCalendarHoursInMonth(
        month,
        resourceId,
        data.workCalendar,
        data.personCalendar,
      );
      calendarTotalsCache.set(key, totals);
    }
    return totals;
  };
  const autoHours = (resourceId: string, month: string) => {
    const totals = calendarTotals(resourceId, month);
    return totals.baseHours - totals.leaveHours;
  };
  const nonWorkingHours = (resourceId: string, month: string) => {
    const totals = calendarTotals(resourceId, month);
    return (
      workdaysInMonth(month) * HOURS_PER_WORKDAY -
      totals.baseHours +
      totals.leaveHours
    );
  };
  const effectiveHours = (resourceId: string, month: string) => {
    const manual = data.actualWorkedHours?.[resourceId + "|" + month];
    return manual === undefined
      ? autoHours(resourceId, month)
      : Math.max(0, manual - nonWorkingHours(resourceId, month));
  };
  for (const [key, amount] of Object.entries(data.actualAllocations || {})) {
    const [personId, , month] = key.split("|");
    personMonthTotals[personId + "|" + month] =
      (personMonthTotals[personId + "|" + month] || 0) + amount;
  }
  for (const resource of people)
    for (const month of months) {
      const key = resource.id + "|" + month;
      personMonthTotals[key] =
        (personMonthTotals[key] || 0) +
        calendarTotals(resource.id, month).trainingHours /
          DEFAULT_MONTHLY_HOURS;
    }
  const years = [...new Set(months.map((month) => month.slice(0, 4)))];
  const selectedHoursMonth =
    selectedCell &&
    months.includes(selectedCell.month) &&
    selectedCell.month <= currentMonth
      ? selectedCell.month
      : undefined;
  const selectedHoursPerson = selectedHoursMonth
    ? people.find(
        (resource) =>
          resource.id === selectedCell?.resourceId &&
          eligible.has(resource.id + "|" + selectedHoursMonth),
      )
    : undefined;
  function selectHoursContext(resourceId: string, month: string, key: string) {
    if (month > currentMonth || !eligible.has(resourceId + "|" + month)) return;
    setSelectedCell((previous) =>
      previous?.key === key ? previous : { key, resourceId, month },
    );
  }

  async function save(
    resource: Resource,
    project: Project,
    month: string,
    entry: { unit: ActualUnit; value: number },
  ) {
    const key = resource.id + "|" + project.id + "|" + month;
    onSaved(
      await writeLocal(
        "actual",
        key,
        entry,
        data.revisions["actual:" + key] || 0,
      ),
    );
  }
  async function saveHours(
    resource: Resource,
    month: string,
    hours: number | null,
    input: HTMLInputElement | null,
  ): Promise<boolean> {
    const nextHours = hours ?? autoHours(resource.id, month);
    const limit = actualInputToFte(100, "percent", month, nextHours);
    const allocated = personMonthTotals[resource.id + "|" + month] || 0;
    if (allocated > limit + 1e-9) {
      openLimit("hours", input);
      return false;
    }
    const key = resource.id + "|" + month;
    try {
      const storedHours =
        hours === null ? null : hours + nonWorkingHours(resource.id, month);
      onSaved(
        await writeLocal(
          "workedHours",
          key,
          storedHours,
          data.revisions["workedHours:" + key] || 0,
        ),
      );
      return true;
    } catch (cause) {
      const message = (cause as Error).message;
      if (message.includes("%100") || message.includes("kapasitesini aşıyor")) {
        openLimit("hours", input);
        return false;
      }
      throw cause;
    }
  }
  function amountFor(resource: Resource, project: Project, month: string) {
    return (
      data.actualAllocations?.[resource.id + "|" + project.id + "|" + month] ||
      0
    );
  }
  return (
    <section className="panel person-allocation">
      <div className="panelhead">
        <div>
          <h2>AA Gerçekleşen Kaynak Dağılımı</h2>
          <p>
            Proje tarihleri arasında kalan, içinde bulunduğumuz ay ve önceki
            aylara kaynak girilebilir.
          </p>
        </div>
        <div className="actual-unit-control">
          <div className="actual-control-fields">
            <div className="actual-control-item actual-context-item actual-person-item">
              <span>Çalışan</span>
              <div className="actual-person-value">
                {canEditCalendar && (
                  <button
                    type="button"
                    className="actual-shared-calendar-button"
                    title="Tüm çalışanlara uygulanan çalışma dışı günleri düzenle"
                    aria-label="Çalışma Takvimi'ni aç"
                    onClick={() => {
                      setCalendarPerson(null);
                      setCalendarMode("shared");
                    }}
                  >
                    <CalendarDays size={16} />
                    <span>Çalışma Takvimi</span>
                  </button>
                )}
                <strong
                  className={
                    selectedHoursPerson ? "" : "actual-context-placeholder"
                  }
                  title={
                    selectedHoursPerson?.name ||
                    "Tablodaki bir kaynak hücresini seçin"
                  }
                  aria-live="polite"
                >
                  {selectedHoursPerson?.name || "Hücre Seçiniz"}
                </strong>
              </div>
            </div>
            <div className="actual-control-item actual-context-item actual-month-item">
              <span>Ay</span>
              <strong
                className={
                  selectedHoursPerson ? "" : "actual-context-placeholder"
                }
                aria-live="polite"
              >
                {selectedHoursPerson && selectedHoursMonth
                  ? fullMonthFormat.format(
                      new Date(selectedHoursMonth + "-01T12:00:00"),
                    ) +
                    " " +
                    selectedHoursMonth.slice(0, 4)
                  : "Hücre Seçiniz"}
              </strong>
            </div>
            <div className="actual-control-item actual-hours-item">
              <span>Aylık Çalışılan Saat</span>
              {selectedHoursPerson && selectedHoursMonth ? (
                <WorkedHours
                  key={selectedHoursPerson.id + "|" + selectedHoursMonth}
                  resource={selectedHoursPerson}
                  month={selectedHoursMonth}
                  value={
                    data.actualWorkedHours?.[
                      selectedHoursPerson.id + "|" + selectedHoursMonth
                    ] === undefined
                      ? undefined
                      : effectiveHours(
                          selectedHoursPerson.id,
                          selectedHoursMonth,
                        )
                  }
                  calculatedHours={autoHours(
                    selectedHoursPerson.id,
                    selectedHoursMonth,
                  )}
                  disabled={false}
                  onSave={(hours, input) =>
                    saveHours(
                      selectedHoursPerson,
                      selectedHoursMonth,
                      hours,
                      input,
                    )
                  }
                />
              ) : (
                <span
                  className="actual-hours-placeholder"
                  aria-label="Çalışan ve ay seçilmedi"
                >
                  Hücre Seçiniz
                </span>
              )}
            </div>
            <label
              className="actual-control-item actual-unit-item"
              htmlFor="actual-entry-unit"
            >
              <span>Kaynak Dağıtım Birimi</span>
              <select
                id="actual-entry-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value as ActualUnit)}
              >
                <option value="percent">Yüzde (%)</option>
                <option value="days">Gün</option>
                <option value="hours">Saat</option>
              </select>
            </label>
          </div>
          <small>
            Hafta sonları ve ortak tatiller otomatik düşülür. İzin saatleri
            aylık saatten çıkarılır; eğitim saatleri dağıtılan kaynak yüzdesine
            eklenir. Fazla mesai için saati düzenleyebilirsiniz.
          </small>
        </div>
      </div>
      <Pager
        total={totalRows}
        page={visiblePage}
        size={pageSize}
        onChange={setPage}
        label="Kişi / proje satırı"
      />
      <Table
        todayDate={todayDate}
        todayMonthsKey={months.join("|")}
        className="matrix planning-grid allocation-grid"
        style={{ width: 200 + months.length * monthWidth }}
      >
        <colgroup>
          <col style={{ width: 200 }} />
          {months.map((month) => (
            <col key={month} style={{ width: monthWidth }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="yearrow">
            <TableHead>Yıl</TableHead>
            {years.map((year, index) => (
              <TableHead
                key={year}
                colSpan={
                  months.filter((month) => month.startsWith(year)).length
                }
                className={"year-band-" + (index % 6)}
              >
                {year}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            <TableHead>Proje / Kişi</TableHead>
            {months.map((month) => (
              <TableHead
                key={month}
                data-month={month}
                className={
                  "monthhead year-band-" +
                  (years.indexOf(month.slice(0, 4)) % 6)
                }
                title={
                  month +
                  " · " +
                  workdaysInMonth(month) +
                  " hafta içi gün · ortak takvime göre saat hesabı"
                }
              >
                <span>
                  {fullMonthFormat.format(new Date(month + "-01T12:00:00"))}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const project = projects[group.outer];
            return (
              <React.Fragment key={project.id}>
                <TableRow className="group actual-project-group">
                  <TableCell className="actual-project-name">
                    <strong>{project.name}</strong>
                    <ProjectResponsible project={project} />
                    <span>
                      {project.start} — {project.end}
                    </span>
                  </TableCell>
                  {months.map((month) => {
                    const text =
                      month >= project.start && month <= project.end
                        ? project.phases[month]?.trim()
                        : "";
                    return (
                      <TableCell key={month} className="actual-phase-cell">
                        {text && (
                          <button
                            type="button"
                            className="actual-phase-button"
                            style={phaseStyle(project, month)}
                            title={text}
                            aria-label={
                              project.name + " / " + month + " aşaması: " + text
                            }
                            onClick={() => setPhaseDetail({ project, month })}
                          >
                            {text}
                          </button>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {people.length > 0 &&
                  group.inners.map((index) => {
                    const resource = people[index];
                    return (
                      <React.Fragment key={project.id + "|" + resource.id}>
                        <TableRow>
                          <TableCell className="rowname">
                            <button
                              type="button"
                              className="person-calendar-trigger"
                              aria-label={
                                resource.name + " izin ve eğitim takvimini aç"
                              }
                              title={
                                resource.name + " · izin ve eğitim takvimi"
                              }
                              onClick={() => {
                                setCalendarPerson(resource);
                                setCalendarMode("personal");
                              }}
                            >
                              <CalendarDays size={15} />
                            </button>
                            <span className="indent">↳</span>
                            {resource.name}
                          </TableCell>
                          {months.map((month) => {
                            const key =
                              resource.id + "|" + project.id + "|" + month;
                            const amount = amountFor(resource, project, month);
                            const selectable =
                              month <= currentMonth &&
                              eligible.has(resource.id + "|" + month) &&
                              month >= project.start &&
                              month <= project.end;
                            return (
                              <TableCell
                                key={month}
                                data-actual-context-cell={
                                  selectable ? "true" : undefined
                                }
                                className={
                                  [
                                    amount > 0 ? "has-entry" : "",
                                    selectedCell?.key === key
                                      ? "actual-context-selected"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ") || undefined
                                }
                                onClick={() => {
                                  if (selectable)
                                    selectHoursContext(resource.id, month, key);
                                }}
                                onFocusCapture={() => {
                                  if (selectable)
                                    selectHoursContext(resource.id, month, key);
                                }}
                              >
                                <Amount
                                  value={amount}
                                  month={month}
                                  unit={unit}
                                  workedHours={effectiveHours(
                                    resource.id,
                                    month,
                                  )}
                                  savedPercent={
                                    data.actualPercentEntries?.[key]
                                  }
                                  otherAllocated={
                                    (personMonthTotals[
                                      resource.id + "|" + month
                                    ] || 0) - amount
                                  }
                                  fullyAllocated={
                                    (personMonthTotals[
                                      resource.id + "|" + month
                                    ] || 0) >=
                                    actualInputToFte(
                                      100,
                                      "percent",
                                      month,
                                      effectiveHours(resource.id, month),
                                    ) -
                                      1e-9
                                  }
                                  disabled={!selectable}
                                  onLimitExceeded={(input) =>
                                    openLimit("allocation", input)
                                  }
                                  onDeselect={() => setSelectedCell(null)}
                                  label={
                                    resource.name +
                                    " / " +
                                    project.name +
                                    " / " +
                                    month
                                  }
                                  onSave={(amount) =>
                                    save(resource, project, month, amount)
                                  }
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow className="actual-person-total">
                          <TableCell
                            className="rowname"
                            title={
                              resource.name + " · projeler ve eğitim toplamı"
                            }
                          >
                            <span className="indent">↳</span>Dağıtılan Kaynak
                            %'si
                          </TableCell>
                          {months.map((month) => {
                            const allocated =
                              personMonthTotals[resource.id + "|" + month] || 0;
                            const monthlyCapacity = actualInputToFte(
                              100,
                              "percent",
                              month,
                              effectiveHours(resource.id, month),
                            );
                            const percent =
                              monthlyCapacity > 0
                                ? (allocated / monthlyCapacity) * 100
                                : 0;
                            const visible = eligible.has(
                              resource.id + "|" + month,
                            );
                            const key = resource.id + "|total|" + month;
                            return (
                              <TableCell
                                key={month}
                                data-actual-context-cell={
                                  visible ? "true" : undefined
                                }
                                className={
                                  [
                                    visible && percent >= 100 - 1e-8
                                      ? "actual-total-full"
                                      : "",
                                    selectedCell?.key === key
                                      ? "actual-context-selected"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ") || undefined
                                }
                                onClick={() => {
                                  if (visible)
                                    selectHoursContext(resource.id, month, key);
                                }}
                                title={
                                  resource.name +
                                  " · " +
                                  month +
                                  " · projeler ve " +
                                  numberFormat.format(
                                    calendarTotals(resource.id, month)
                                      .trainingHours,
                                  ) +
                                  " saat eğitim"
                                }
                              >
                                {visible
                                  ? "%" + numberFormat.format(percent)
                                  : "—"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      <WorkCalendarDialog
        open={calendarMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCalendarMode(null);
            setCalendarPerson(null);
          }
        }}
        data={data}
        mode={calendarMode || "personal"}
        resource={calendarPerson}
        canEdit={canEditCalendar}
        canEditPersonal={
          !!calendarPerson &&
          (canEditCalendar || calendarPerson.id === ownResourceId)
        }
        onSaved={onSaved}
        initialYear={Number((selectedCell?.month || currentMonth).slice(0, 4))}
      />
      <Dialog
        open={limitOpen}
        onOpenChange={(open) => {
          limitOpenRef.current = open;
          setLimitOpen(open);
        }}
      >
        <DialogContent
          className="actual-limit-dialog"
          onCloseAutoFocus={(event) => {
            const input = limitReturnInput.current;
            if (input?.isConnected && !input.disabled) {
              event.preventDefault();
              requestAnimationFrame(() => {
                if (input.isConnected && !input.disabled) {
                  input.focus();
                  input.select();
                }
              });
            }
            limitReturnInput.current = null;
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {limitKind === "hours"
                ? "Çalışma Saati Sınırı"
                : "Kaynak Dağılımı Sınırı"}
            </DialogTitle>
            <DialogDescription>
              {limitKind === "hours" ? hoursLimitMessage : limitMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="actual-limit-actions">
            <button
              type="button"
              className="button primary"
              onClick={closeLimit}
            >
              Tamam
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!phaseDetail}
        onOpenChange={(open) => {
          if (!open) setPhaseDetail(null);
        }}
      >
        <DialogContent className="editor phasedetail">
          <DialogHeader>
            <DialogTitle>
              {phaseDetail?.project.name}
              <ProjectResponsible project={phaseDetail?.project} />
            </DialogTitle>
            <DialogDescription>
              {phaseDetail &&
                fullMonthFormat.format(
                  new Date(phaseDetail.month + "-01T12:00:00"),
                ) +
                  " " +
                  phaseDetail.month.slice(0, 4)}
            </DialogDescription>
          </DialogHeader>
          {phaseDetail && (
            <div
              className="phasedetailtext"
              style={phaseStyle(phaseDetail.project, phaseDetail.month)}
            >
              {phaseDetail.project.phases[phaseDetail.month]}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {!projects.length && (
        <p className="emptymsg">Seçili filtrelerde proje bulunamadı.</p>
      )}
      {!!projects.length && !people.length && (
        <p className="emptymsg">
          Seçili filtrelerde dağıtılabilir kişi bulunamadı; proje aşamaları
          gösteriliyor.
        </p>
      )}
    </section>
  );
}
