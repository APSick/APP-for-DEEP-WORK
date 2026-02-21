// src/components/StatsCard.tsx
import { useState } from "react";
import { TEXTS } from "../constants";
import { ConfirmDialog } from "./ConfirmDialog";
import type { StatsPeriod } from "../hooks/useStats";
import type { ChartBar } from "../hooks/useStats";

interface StatsCardProps {
  statsPeriod: StatsPeriod;
  currentStats: { minutes: number; sessionsCount: number };
  chartData: ChartBar[];
  customStatsFrom: number;
  customStatsTo: number;
  onPeriodChange: (period: StatsPeriod) => void;
  onCustomFromChange: (from: number) => void;
  onCustomToChange: (to: number) => void;
  onClearHistory: () => void;
}

const SHOW_CHART_PERIODS: StatsPeriod[] = ["week", "month", "year", "custom"];

export function StatsCard({
  statsPeriod,
  currentStats,
  chartData,
  customStatsFrom,
  customStatsTo,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
  onClearHistory,
}: StatsCardProps) {
  const [customStatsOpen, setCustomStatsOpen] = useState(false);
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

        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <div className="dropdownWrap">
            <button className="pillButton" onClick={() => setCustomStatsOpen((v) => !v)}>
              <span className="pillText">{periodLabel}</span>
              <span className="caret">▼</span>
            </button>

            {customStatsOpen && (
              <div className="glassMenu">
                <div className="menu">
                  <button
                    className={`menuItem ${statsPeriod === "day" ? "menuActive" : ""}`}
                    onClick={() => {
                      onPeriodChange("day");
                      setCustomStatsOpen(false);
                    }}
                  >
                    <span className="check">{statsPeriod === "day" ? "✓" : ""}</span>
                    {TEXTS.statsPeriodDay}
                  </button>
                  <button
                    className={`menuItem ${statsPeriod === "week" ? "menuActive" : ""}`}
                    onClick={() => {
                      onPeriodChange("week");
                      setCustomStatsOpen(false);
                    }}
                  >
                    <span className="check">{statsPeriod === "week" ? "✓" : ""}</span>
                    {TEXTS.statsPeriodWeek}
                  </button>
                  <button
                    className={`menuItem ${statsPeriod === "month" ? "menuActive" : ""}`}
                    onClick={() => {
                      onPeriodChange("month");
                      setCustomStatsOpen(false);
                    }}
                  >
                    <span className="check">{statsPeriod === "month" ? "✓" : ""}</span>
                    {TEXTS.statsPeriodMonth}
                  </button>
                  <button
                    className={`menuItem ${statsPeriod === "year" ? "menuActive" : ""}`}
                    onClick={() => {
                      onPeriodChange("year");
                      setCustomStatsOpen(false);
                    }}
                  >
                    <span className="check">{statsPeriod === "year" ? "✓" : ""}</span>
                    {TEXTS.statsPeriodYear}
                  </button>
                  <button
                    className={`menuItem ${statsPeriod === "custom" ? "menuActive" : ""}`}
                    onClick={() => {
                      onPeriodChange("custom");
                      setCustomStatsOpen(false);
                    }}
                  >
                    <span className="check">{statsPeriod === "custom" ? "✓" : ""}</span>
                    {TEXTS.statsPeriodCustomLabel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="muted" style={{ marginTop: 8, marginBottom: 16 }}>
          {TEXTS.statsTotal}: {currentStats.minutes ? `${currentStats.minutes} ${TEXTS.minutes}` : "—"} •{" "}
          {currentStats.sessionsCount} {sessionsLabel}
        </div>

        {SHOW_CHART_PERIODS.includes(statsPeriod) && chartData.length > 0 && (() => {
          const maxMinutes = Math.max(1, ...chartData.map((b) => b.minutes));
          return (
            <div className="statsChartWrap">
              <div
                className="statsChart"
                role="img"
                aria-label={`График по ${statsPeriod === "week" ? "дням недели" : statsPeriod === "month" ? "дням месяца" : "месяцам"}`}
              >
                {chartData.map((bar, i) => (
                  <div key={i} className="statsChartBarCell">
                    <div
                      className="statsChartBar"
                      style={{
                        height: `${(bar.minutes / maxMinutes) * 100}%`,
                      }}
                      title={`${bar.label}: ${bar.minutes} ${TEXTS.minutes}`}
                    />
                    <span className="statsChartLabel">{bar.label}</span>
                  </div>
                ))}
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
