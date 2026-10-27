"use client";

import "./ChartSetup";
import { Bar } from "react-chartjs-2";
import { useChartTheme } from "./useChartTheme";

const WEEKDAYS = ["Дс", "Сс", "Ср", "Бс", "Жм", "Сб", "Жс"];

export function ActivityBarChart({
  values,
  unit = "минут",
}: {
  values: number[];
  /** What a bar counts: minutes in the demo cohort, recorded actions in live data. */
  unit?: string;
}) {
  const t = useChartTheme();

  return (
    <Bar
      key={t.version}
      data={{
        labels: WEEKDAYS,
        datasets: [
          {
            label: `Белсенділік (${unit})`,
            data: values,
            backgroundColor: values.map((_, i) =>
              // Weekend bars stay muted so the working-week rhythm reads first.
              i >= 5 ? "rgba(139,92,246,0.55)" : "rgba(51,102,255,0.85)"
            ),
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      }}
      options={{
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.tooltipText,
            borderColor: t.gridStrong,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: { label: (c) => `${c.formattedValue} ${unit}` },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: t.grid },
            border: { display: false },
            ticks: { color: t.textMuted, font: { size: 11 } },
          },
          x: {
            grid: { display: false },
            border: { color: t.grid },
            ticks: { color: t.textMuted, font: { size: 11 } },
          },
        },
      }}
    />
  );
}
