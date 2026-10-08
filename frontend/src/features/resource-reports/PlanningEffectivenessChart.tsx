import { useMemo } from "react";
import { planningEffectiveness } from "../../../../shared/resource-planning-reports";
import { fmt } from "../../format";
import MonthlyComparison from "./MonthlyComparison";

export default function PlanningEffectivenessChart({
  months,
  scope,
}: {
  months: { month: string; planned: number; actual: number }[];
  scope: string;
}) {
  const effectiveness = useMemo(() => planningEffectiveness(months), [months]);
  return (
    <section className="panel resource-report planning-effectiveness-report">
      <header className="resource-report-head">
        <div>
          <span className="resource-report-eyebrow">PLANLAMA VE UYGULAMA</span>
          <h2>Kaynak Planlama Süreci Etkinlik Grafiği</h2>
          <p>{scope}</p>
        </div>
        <span className="resource-report-chip">
          Dönem etkinliği:{" "}
          {effectiveness.percent == null
            ? "Hesaplanamaz"
            : "%" + fmt(effectiveness.percent)}
        </span>
      </header>
      <MonthlyComparison
        title="Kaynak Planlama Süreci Etkinlik Grafiği"
        months={months.map((point) => point.month)}
        series={[
          {
            name: "Etkinlik",
            values: effectiveness.months.map((point) => point.percent),
            color: "var(--brand-primary, #405341)",
          },
        ]}
        unit="percent"
        reference={100}
      />
      <p className="resource-report-note">
        Etkinlik = gerçekleşen dağılım / planlanan dağılım × 100. %100 plana
        eşit; %100 üzeri planı aşan gerçekleşen kaynağı gösterir. Planlanan
        dağılım sıfırsa oran hesaplanamaz ve grafikte boşluk bırakılır. Dönem
        etkinliği, seçili dönemin gerçekleşen toplamının planlanan toplamına
        oranıdır. Liderlik, takım ve dönem filtreleri uygulanır.
      </p>
    </section>
  );
}
