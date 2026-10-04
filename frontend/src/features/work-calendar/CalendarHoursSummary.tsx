import type { WorkCalendarView } from "./useWorkCalendarView";

export default function CalendarHoursSummary({
  rows,
}: {
  rows: WorkCalendarView["monthRows"];
}) {
  return (
    <div className="work-calendar-summary">
      <h3>Aylık Çalışma Saatleri</h3>
      <div className="work-calendar-months">
        {rows.map((row) => {
          const personal = row.personal;
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
  );
}
