import { useMemo } from "react";
import type { Metric } from "./metrics";
import { buildMonthlyShortageTrend } from "./monthly-shortage-trend";

const numberFormat = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});
const monthFormat = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
});
const fmt = (value: number) => numberFormat.format(value);
const monthLabel = (month: string) =>
  monthFormat.format(new Date(month + "-01T12:00:00"));

type Props = {
  capacity: Record<string, Metric>;
  teamIds: string[];
  months: string[];
  filterLabel: string;
};

export default function MonthlyShortageTrend({
  capacity,
  teamIds,
  months,
  filterLabel,
}: Props) {
  const teamKey = teamIds.join("|");
  const points = useMemo(
    () => buildMonthlyShortageTrend(capacity, teamIds, months),
    [capacity, teamKey, months],
  );
  const periodAverage = points.length
    ? points.reduce((sum, point) => sum + point.average, 0) / points.length
    : 0;
  const top = Math.max(1, ...points.map((point) => point.average));
  const step = Math.pow(10, Math.floor(Math.log10(top / 4)));
  const tick = Math.ceil(top / (4 * step)) * step;
  const maxValue = tick * 4;
  const width = Math.max(780, points.length * 62 + 78),
    height = 274;
  const left = 58,
    right = width - 24,
    baseline = 214,
    chartHeight = 164;
  const barWidth = 20;
  const center = (index: number) =>
    left + ((index + 0.5) * (right - left)) / Math.max(1, points.length);
  const y = (value: number) => baseline - (value / maxValue) * chartHeight;
  const tickStep =
    points.length > 36
      ? 6
      : points.length > 18
        ? 3
        : points.length > 12
          ? 2
          : 1;
  return (
    <section className="panel trend monthly-shortage-trend">
      <div className="panelhead">
        <div>
          <h2>Aylık Ortalama Eksik Kaynaklar</h2>
          <p>
            {filterLabel} · {teamIds.length} takım
          </p>
        </div>
        <div className="shortage-summary">
          <span>Dönem Ortalaması</span>
          <strong>
            {fmt(periodAverage)} <small>kişi eşdeğeri / takım</small>
          </strong>
        </div>
      </div>
      {teamIds.length && points.length ? (
        <div className="chartscroll">
          <svg
            role="img"
            aria-label="Aylık ortalama eksik kaynaklar"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <title>Aylık ortalama eksik kaynaklar</title>
            {[0, 1, 2, 3, 4].map((index) => (
              <g key={index}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(index * tick)}
                  y2={y(index * tick)}
                  stroke="#e4ebf2"
                />
                <text
                  x={left - 10}
                  y={y(index * tick) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="#6d8092"
                >
                  {fmt(index * tick)}
                </text>
              </g>
            ))}
            {points.map((point, index) => {
              const x = center(index),
                label = monthLabel(point.month);
              return (
                <g key={point.month}>
                  <rect
                    x={x - barWidth / 2}
                    y={y(point.average)}
                    width={barWidth}
                    height={Math.max(0, baseline - y(point.average))}
                    rx={3}
                    fill="#527ca9"
                  >
                    <title>
                      {label} · Ortalama eksik kaynak: {fmt(point.average)} ·
                      Toplam eksik kaynak: {fmt(point.total)} · Takım sayısı:{" "}
                      {point.teamCount}
                    </title>
                  </rect>
                  {(index % tickStep === 0 || index === points.length - 1) && (
                    <text
                      x={x}
                      y={239}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#61758b"
                    >
                      {point.month.slice(5)}/{point.month.slice(2, 4)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p className="emptymsg">
          Grafik için liderlik veya takım seçimine uygun takım bulunamadı.
        </p>
      )}
      <p className="chartnote">
        Her takımın aylık eksik kaynağı, planlanan tahsislerin aktif kaynağı
        aşan kısmıdır. Seçili takımların eksikleri toplanıp takım sayısına
        bölünür; bir takımın fazlası başka takımın açığını kapatmaz.
      </p>
    </section>
  );
}
