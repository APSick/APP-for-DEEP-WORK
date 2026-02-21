// src/hooks/useStats.ts
import { useMemo, useState } from "react";
import type { Session } from "../storage";

export type StatsPeriod = "day" | "week" | "month" | "year" | "custom";

export type ChartBar = { label: string; minutes: number };

const MONTH_NAMES_SHORT = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Понедельник 00:00 для данной даты */
function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysToMonday);
  return d.getTime();
}

const DAY_MS = 24 * 3600 * 1000;
const ONE_MONTH_DAYS = 31;
const THREE_MONTHS_DAYS = 92;

export function useStats(history: Session[]) {
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("week");
  const [customStatsFrom, setCustomStatsFrom] = useState<number>(Date.now() - 7 * 24 * 3600 * 1000);
  const [customStatsTo, setCustomStatsTo] = useState<number>(Date.now());

  const { todayStats, weekStats, currentStats, chartData } = useMemo(() => {
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

    // Данные для графика: по дням (неделя/месяц) или по месяцам (год)
    let chartData: ChartBar[] = [];

    if (statsPeriod === "week") {
      const buckets = new Map<number, number>();
      const dayMs = 24 * 3600 * 1000;
      for (let i = 0; i < 7; i++) {
        const t = startOfDay(now - (6 - i) * dayMs);
        buckets.set(t, 0);
      }
      for (const s of history) {
        if (s.type !== "focus") continue;
        const key = startOfDay(s.endedAt);
        if (buckets.has(key)) buckets.set(key, buckets.get(key)! + s.durationSec);
      }
      const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
      chartData = sortedKeys.map((key) => {
        const d = new Date(key);
        const label = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
        return { label, minutes: Math.round((buckets.get(key)! / 60) * 10) / 10 };
      });
    } else if (statsPeriod === "month") {
      const buckets = new Map<number, number>();
      const dayMs = 24 * 3600 * 1000;
      for (let i = 0; i < 30; i++) {
        const t = startOfDay(now - (29 - i) * dayMs);
        buckets.set(t, 0);
      }
      for (const s of history) {
        if (s.type !== "focus") continue;
        const key = startOfDay(s.endedAt);
        if (buckets.has(key)) buckets.set(key, buckets.get(key)! + s.durationSec);
      }
      const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
      chartData = sortedKeys.map((key) => {
        const d = new Date(key);
        const label = `${d.getDate()}`;
        return { label, minutes: Math.round((buckets.get(key)! / 60) * 10) / 10 };
      });
    } else if (statsPeriod === "year") {
      const buckets = new Map<number, number>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - (11 - i));
        const t = startOfMonth(d.getTime());
        buckets.set(t, 0);
      }
      for (const s of history) {
        if (s.type !== "focus") continue;
        const key = startOfMonth(s.endedAt);
        if (buckets.has(key)) buckets.set(key, buckets.get(key)! + s.durationSec);
      }
      const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
      chartData = sortedKeys.map((key) => {
        const d = new Date(key);
        const label = MONTH_NAMES_SHORT[d.getMonth()];
        return { label, minutes: Math.round((buckets.get(key)! / 60) * 10) / 10 };
      });
    } else if (statsPeriod === "custom") {
      const from = startOfDay(fromCustom);
      const to = toCustom;
      const rangeDays = (to - from) / DAY_MS;

      if (rangeDays <= ONE_MONTH_DAYS) {
        // До 1 месяца — по дням
        const buckets = new Map<number, number>();
        const toDayStart = startOfDay(to);
        for (let t = from; t <= toDayStart; t += DAY_MS) {
          buckets.set(t, 0);
        }
        for (const s of history) {
          if (s.type !== "focus") continue;
          const key = startOfDay(s.endedAt);
          if (s.endedAt >= from && s.endedAt <= to && buckets.has(key))
            buckets.set(key, buckets.get(key)! + s.durationSec);
        }
        const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
        chartData = sortedKeys.map((key) => {
          const d = new Date(key);
          const label = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
          return { label, minutes: Math.round((buckets.get(key)! / 60) * 10) / 10 };
        });
      } else if (rangeDays <= THREE_MONTHS_DAYS) {
        // Свыше 1 месяца до 3 месяцев — по неделям
        const buckets = new Map<number, number>();
        let weekStart = startOfWeek(from);
        while (weekStart <= to) {
          buckets.set(weekStart, 0);
          weekStart += 7 * DAY_MS;
        }
        for (const s of history) {
          if (s.type !== "focus") continue;
          const key = startOfWeek(s.endedAt);
          if (s.endedAt >= from && s.endedAt <= to && buckets.has(key))
            buckets.set(key, buckets.get(key)! + s.durationSec);
        }
        const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
        chartData = sortedKeys.map((key) => {
          const d = new Date(key);
          const label = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
          return { label, minutes: Math.round((buckets.get(key)! / 60) * 10) / 10 };
        });
      } else {
        // Свыше 3 месяцев — по месяцам
        const buckets = new Map<number, number>();
        let monthStart = startOfMonth(from);
        const toMonthStart = startOfMonth(to);
        while (monthStart <= toMonthStart) {
          buckets.set(monthStart, 0);
          const d = new Date(monthStart);
          d.setMonth(d.getMonth() + 1);
          monthStart = d.getTime();
        }
        for (const s of history) {
          if (s.type !== "focus") continue;
          const key = startOfMonth(s.endedAt);
          if (s.endedAt >= from && s.endedAt <= to && buckets.has(key))
            buckets.set(key, buckets.get(key)! + s.durationSec);
        }
        const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
        chartData = sortedKeys.map((key) => {
          const d = new Date(key);
          const label = MONTH_NAMES_SHORT[d.getMonth()];
          return { label, minutes: Math.round((buckets.get(key)! / 60) * 10) / 10 };
        });
      }
    }

    return {
      todayStats: { minutes: Math.round(dayMinutes / 60), sessionsCount: dayCount },
      weekStats: { minutes: Math.round(weekMinutes / 60), sessionsCount: weekCount },
      currentStats: {
        minutes: Math.round(periodMinutes / 60),
        sessionsCount: periodCount,
      },
      chartData,
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
    chartData,
  };
}
