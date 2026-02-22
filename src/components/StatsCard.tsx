// src/components/StatsCard.tsx
/**
 * Карточка статистики: выбор периода (день/неделя/месяц/год/произвольный),
 * блок «Всего», столбчатый график с пунктирными линиями (максимум и среднее по периоду).
 * Для месяца: название месяца над «Всего», числа дней без троеточий.
 */
import { useState } from "react";
import { TEXTS } from "../constants";
import { ConfirmDialog } from "./ConfirmDialog";
import type { StatsPeriod } from "../hooks/useStats";
import type { ChartBar } from "../hooks/useStats";

interface StatsCardProps {
  statsPeriod: StatsPeriod;
  currentStats: { minutes: number; sessionsCount: number };
  chartData: ChartBar[];
  currentMonthName: string | null;
  currentYearName: string | null;
  currentWeekLabel: string | null;
  showPeriodArrows: boolean;
  canGoNext: boolean;
  onPeriodPrev: () => void;
  onPeriodNext: () => void;
  customStatsFrom: number;
  customStatsTo: number;
  onPeriodChange: (period: StatsPeriod) => void;
  onCustomFromChange: (from: number) => void;
  onCustomToChange: (to: number) => void;
  onClearHistory: () => void;
}

/** Периоды, для которых показывается график со столбцами и пунктирными линиями */
const SHOW_CHART_PERIODS: StatsPeriod[] = ["day", "week", "month", "year", "custom"];

/** Форматирует минуты: «30 мин» или «2 ч 30 мин» для подписей у пунктирных линий и tooltip */
function formatMinutes(m: number): string {
  if (m < 60) return `${m} ${TEXTS.minutes}`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return min ? `${h} ${TEXTS.hours} ${min} ${TEXTS.minutes}` : `${h} ${TEXTS.hours}`;
}

export function StatsCard({
  statsPeriod,
  currentStats,
  chartData,
  currentMonthName,
  currentYearName,
  currentWeekLabel,
  showPeriodArrows,
  canGoNext,
  onPeriodPrev,
  onPeriodNext,
  customStatsFrom,
  customStatsTo,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
  onClearHistory,
}: StatsCardProps) {
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const periodLabel =
    statsPeriod === "day"
      ? TEXTS.statsPeriodDay
      : statsPeriod === "week"
      ? TEXTS.statsPeriodWeek
      : statsPeriod === "month"
      ? TEXTS.statsPeriodMonth
      : statsPeriod === "year"
      ? TEXTS.statsPeriodYear
      : TEXTS.statsPeriodCustom;

  const sessionsLabel =
    currentStats.sessionsCount === 1 ? TEXTS.statsSessions : TEXTS.statsSessionsPlural;

  return (
    <>
      <div className="glass card focusCard">
        <div className="row between">
          <div className="cardTitle">{TEXTS.stats}</div>
          <button className="btnDangerOutline" onClick={() => setShowClearConfirm(true)}>
            {TEXTS.statsClear}
          </button>
        </div>

        <div style={{ marginTop: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          {showPeriodArrows && (
            <>
              <button
                type="button"
                className="statsPeriodArrow"
                onClick={onPeriodPrev}
                aria-label="Предыдущий период"
              >
                ←
              </button>
              <button
                type="button"
                className="statsPeriodArrow"
                onClick={onPeriodNext}
                disabled={!canGoNext}
                aria-label="Следующий период"
              >
                →
              </button>
            </>
          )}
          <button
            className="pillButton"
            onClick={() => setPeriodModalOpen(true)}
            style={{ flex: 1 }}
          >
            <span className="pillText">{periodLabel}</span>
            <span className="caret">▼</span>
          </button>
        </div>

        {periodModalOpen && (
          <div className="overlay overlay--darker" onClick={() => setPeriodModalOpen(false)}>
            <div className="glass modal" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div className="modalTitle">{TEXTS.statsPeriodSelect}</div>
                <button className="btnOutline" onClick={() => setPeriodModalOpen(false)}>
                  {TEXTS.close}
                </button>
              </div>
              <div className="projectsList modalList">
                {(
                  [
                    { value: "day" as const, label: TEXTS.statsPeriodDay },
                    { value: "week" as const, label: TEXTS.statsPeriodWeek },
                    { value: "month" as const, label: TEXTS.statsPeriodMonth },
                    { value: "year" as const, label: TEXTS.statsPeriodYear },
                    { value: "custom" as const, label: TEXTS.statsPeriodCustomLabel },
                  ] as const
                ).map(({ value, label }) => (
                  <div
                    key={value}
                    className={`projectsItem ${statsPeriod === value ? "projectsItemActive" : ""}`}
                  >
                    <button
                      className="projectsPick"
                      onClick={() => {
                        onPeriodChange(value);
                        setPeriodModalOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="muted" style={{ marginTop: 8, marginBottom: 16 }}>
          {statsPeriod === "month" && currentMonthName && (
            <div style={{ marginBottom: 4, fontSize: 14 }}>{currentMonthName}</div>
          )}
          {statsPeriod === "year" && currentYearName && (
            <div style={{ marginBottom: 4, fontSize: 14 }}>{currentYearName}</div>
          )}
          {statsPeriod === "week" && currentWeekLabel && (
            <div style={{ marginBottom: 4, fontSize: 14 }}>Неделя {currentWeekLabel}</div>
          )}
          {TEXTS.statsTotal}: {currentStats.minutes ? `${currentStats.minutes} ${TEXTS.minutes}` : "—"} •{" "}
          {currentStats.sessionsCount} {sessionsLabel}
        </div>

        {SHOW_CHART_PERIODS.includes(statsPeriod) && chartData.length > 0 && (() => {
          const maxMinutes = Math.max(1, ...chartData.map((b) => b.minutes));
          const totalMinutes = chartData.reduce((s, b) => s + b.minutes, 0);
          const bucketCount = chartData.length;
          const avgMinutes = totalMinutes / bucketCount;
          const MIN_BAR_HEIGHT_PCT = 8;
          const chartAria =
            statsPeriod === "day"
              ? "График по часам дня"
              : statsPeriod === "week"
                ? "График по дням недели"
                : statsPeriod === "month"
                  ? "График по дням"
                  : statsPeriod === "year"
                    ? "График по месяцам"
                    : "График периода";
          const showRefLines = totalMinutes > 0;
          return (
            <div className="statsChartWrap">
              <div className="statsChartContainer">
                {showRefLines && (
                <div className="statsChartRefOverlay" aria-hidden>
                  <div className="statsChartRefLine statsChartRefLineMax" />
                  <span className="statsChartRefLabel statsChartRefLabelMax">{formatMinutes(maxMinutes)}</span>
                  <div className="statsChartRefLine statsChartRefLineAvg" />
                  <span className="statsChartRefLabel statsChartRefLabelAvg">{formatMinutes(Math.round(avgMinutes * 10) / 10)}</span>
                </div>
                )}
                <div
                  className="statsChart"
                  data-period={statsPeriod}
                  role="img"
                  aria-label={chartAria}
                >
                {chartData.map((bar, i) => {
                  const tooltip =
                    statsPeriod === "day"
                      ? `${bar.label}:00–${String((Number(bar.label) + 1) % 24).padStart(2, "0")}:00: ${formatMinutes(bar.minutes)}`
                      : `${bar.label}: ${formatMinutes(bar.minutes)}`;
                  return (
                  <div key={i} className="statsChartBarCell">
                    <div
                      className="statsChartBar"
                      style={{
                        height: `${bar.minutes > 0 ? Math.max(MIN_BAR_HEIGHT_PCT, (bar.minutes / maxMinutes) * 100) : 0}%`,
                      }}
                      title={tooltip}
                    />
                    <span className="statsChartLabel">{bar.label}</span>
                  </div>
                );
                })}
              </div>
              </div>
            </div>
          );
        })()}

        {statsPeriod === "custom" && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
              {TEXTS.statsPeriodSelect}
            </div>
            <div className="customRow">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{TEXTS.statsPeriodFrom}</div>
                <input
                  type="date"
                  value={new Date(customStatsFrom).toISOString().split("T")[0]}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    d.setHours(0, 0, 0, 0);
                    onCustomFromChange(d.getTime());
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "white",
                  }}
                />
              </div>
              <div style={{ flex: 1, marginLeft: 8 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{TEXTS.statsPeriodTo}</div>
                <input
                  type="date"
                  value={new Date(customStatsTo).toISOString().split("T")[0]}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    d.setHours(23, 59, 59, 999);
                    onCustomToChange(d.getTime());
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "white",
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          isOpen={showClearConfirm}
          title={TEXTS.statsClear}
          message={TEXTS.statsClearConfirm}
          confirmLabel={TEXTS.statsClear}
          onConfirm={() => {
            onClearHistory();
            setShowClearConfirm(false);
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </>
  );
}
