// src/hooks/useStats.ts
import { useMemo, useState } from "react";
import type { Session } from "../storage";

export type StatsPeriod = "day" | "week" | "month" | "year" | "custom";

export function useStats(history: Session[]) {
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("week");
  const [customStatsFrom, setCustomStatsFrom] = useState<number>(Date.now() - 7 * 24 * 3600 * 1000);
  const [customStatsTo, setCustomStatsTo] = useState<number>(Date.now());

  const { todayStats, weekStats, currentStats } = useMemo(() => {
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const fromDay = dayStart.getTime();
    const fromWeek = now - 7 * 24 * 3600 * 1000;
    const fromMonth = now - 30 * 24 * 3600 * 1000;
    const fromYear = now - 365 * 24 * 3600 * 1000;

    let dayMinutes = 0;
    let dayCount = 0;
    let weekMinutes = 0;
    let weekCount = 0;
    let periodMinutes = 0;
    let periodCount = 0;

    const fromCustom = customStatsFrom;
    const toCustom = customStatsTo;
    const fromByPeriod =
      statsPeriod === "day"
        ? fromDay
        : statsPeriod === "week"
          ? fromWeek
          : statsPeriod === "month"
            ? fromMonth
            : statsPeriod === "year"
              ? fromYear
              : fromCustom;
    const toByPeriod = statsPeriod === "custom" ? toCustom : now;

    for (const s of history) {
      if (s.type !== "focus") continue;
      const sec = s.durationSec;
      const end = s.endedAt;
      if (end >= fromDay && end <= now) {
        dayMinutes += sec;
        dayCount += 1;
      }
      if (end >= fromWeek && end <= now) {
        weekMinutes += sec;
        weekCount += 1;
      }
      if (end >= fromByPeriod && end <= toByPeriod) {
        periodMinutes += sec;
        periodCount += 1;
      }
    }

    return {
      todayStats: { minutes: Math.round(dayMinutes / 60), sessionsCount: dayCount },
      weekStats: { minutes: Math.round(weekMinutes / 60), sessionsCount: weekCount },
      currentStats: {
        minutes: Math.round(periodMinutes / 60),
        sessionsCount: periodCount,
      },
    };
  }, [history, statsPeriod, customStatsFrom, customStatsTo]);

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
