// src/hooks/useStats.ts
import { useState } from "react";
import type { Session } from "../storage";

export type StatsPeriod = "day" | "week" | "month" | "year" | "custom";

export function useStats(history: Session[]) {
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("week");
  const [customStatsFrom, setCustomStatsFrom] = useState<number>(Date.now() - 7 * 24 * 3600 * 1000);
  const [customStatsTo, setCustomStatsTo] = useState<number>(Date.now());

  function getFilteredStats(period: StatsPeriod): { minutes: number; sessionsCount: number } {
    const now = Date.now();
    let fromMs = now;

    if (period === "day") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      fromMs = d.getTime();
    } else if (period === "week") {
      fromMs = now - 7 * 24 * 3600 * 1000;
    } else if (period === "month") {
      fromMs = now - 30 * 24 * 3600 * 1000;
    } else if (period === "year") {
      fromMs = now - 365 * 24 * 3600 * 1000;
    } else if (period === "custom") {
      fromMs = customStatsFrom;
    }

    const filtered = history.filter(
      (s) => s.type === "focus" && s.endedAt >= fromMs && s.endedAt <= (period === "custom" ? customStatsTo : now)
    );

    const minutes = Math.round(filtered.reduce((acc, s) => acc + s.durationSec, 0) / 60);
    return { minutes, sessionsCount: filtered.length };
  }

  const todayStats = getFilteredStats("day");
  const weekStats = getFilteredStats("week");
  const currentStats = getFilteredStats(statsPeriod);

  return {
    statsPeriod,
    setStatsPeriod,
    customStatsFrom,
    setCustomStatsFrom,
    customStatsTo,
    setCustomStatsTo,
    todayStats,
    weekStats,
    currentStats,
  };
}
