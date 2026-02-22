// src/hooks/useStats.ts
/**
 * Хук useStats: расчёт статистики и данных для графика по сессиям фокуса.
 * Поддерживает периоды: день, календарная неделя (ПН–ВС), календарный месяц, год, произвольный.
 * Для каждого периода считаются сумма минут, число сеансов и массив столбцов графика (label + minutes).
 */

import { useEffect, useMemo, useState } from "react";
import type { Session } from "../storage";

/** Доступные периоды статистики */
export type StatsPeriod = "day" | "week" | "month" | "year" | "custom";

/** Один столбец графика: подпись по оси X и минуты */
export type ChartBar = { label: string; minutes: number };

/** Короткие названия месяцев для подписей (янв, фев, …) */
const MONTH_NAMES_SHORT = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

/** Полные названия месяцев (Январь, Февраль, …) — для заголовка над «Всего» в режиме месяц */
const MONTH_NAMES_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** Дни недели для подписей графика недели: ПН, ВТ, СР, … */
const DAY_NAMES_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

/** Начало календарного дня (00:00:00.000) в ms */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Конец календарного дня (23:59:59.999) в ms */
function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Начало календарного месяца (1-е число, 00:00:00.000) в ms */
function startOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Конец календарного месяца (последний день 23:59:59.999) в ms */
function endOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0); // последний день предыдущего месяца
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Начало календарной недели: понедельник 00:00:00.000 для данной даты (неделя ПН–ВС) */
function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=ВС, 1=ПН, …
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysToMonday);
  return d.getTime();
}

/** Конец календарной недели: воскресенье 23:59:59.999 */
function endOfWeek(ms: number): number {
  const start = startOfWeek(ms);
  return start + 7 * DAY_MS - 1;
}

const DAY_MS = 24 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;
const ONE_MONTH_DAYS = 31;
const THREE_MONTHS_DAYS = 92;

export function useStats(history: Session[]) {
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("week");
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = текущий период, -1 = предыдущий, 1 = следующий
  const [customStatsFrom, setCustomStatsFrom] = useState<number>(Date.now() - 7 * 24 * 3600 * 1000);
  const [customStatsTo, setCustomStatsTo] = useState<number>(Date.now());

  useEffect(() => {
    setPeriodOffset(0);
  }, [statsPeriod]);

  const { todayStats, weekStats, currentStats, chartData, currentMonthName, currentYearName, currentWeekLabel } = useMemo(() => {
    const now = Date.now();

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const fromDay = dayStart.getTime();
    const fromWeek = startOfWeek(now);

    const viewDayDate = new Date(now);
    viewDayDate.setDate(viewDayDate.getDate() + periodOffset);
    const fromDayView = startOfDay(viewDayDate.getTime());
    const toDayView = endOfDay(viewDayDate.getTime());

    const fromWeekView = startOfWeek(now) + periodOffset * 7 * DAY_MS;
    const toWeekView = endOfWeek(fromWeekView);

    const viewMonthDate = new Date(now);
    viewMonthDate.setMonth(viewMonthDate.getMonth() + periodOffset);
    const fromMonth = startOfMonth(viewMonthDate.getTime());
    const toMonth = endOfMonth(viewMonthDate.getTime());

    const viewYear = new Date(now).getFullYear() + periodOffset;
    const fromYear = new Date(viewYear, 0, 1).getTime();
    const toYear = endOfMonth(new Date(viewYear, 11, 1).getTime());

    const fromCustom = customStatsFrom;
    const toCustom = customStatsTo;

    const fromByPeriod =
      statsPeriod === "day"
        ? fromDayView
        : statsPeriod === "week"
          ? fromWeekView
          : statsPeriod === "month"
            ? fromMonth
            : statsPeriod === "year"
              ? fromYear
              : fromCustom;
    const toByPeriod =
      statsPeriod === "day"
        ? toDayView
        : statsPeriod === "month"
          ? toMonth
          : statsPeriod === "year"
            ? toYear
            : statsPeriod === "week"
              ? toWeekView
              : statsPeriod === "custom"
                ? toCustom
                : now;

    let dayMinutes = 0;
    let dayCount = 0;
    let weekMinutes = 0;
    let weekCount = 0;
    let periodMinutes = 0;
    let periodCount = 0;

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

    // Формируем массив столбцов графика в зависимости от периода.
    // День: 24 часа, пересечение сессии с каждым часом в минутах.
    // Неделя: 7 дней (ПН … ВС), подпись «ПН 16», «ВТ 17» и т.д., сумма минут за день.
    // Месяц: 28–31 день, подпись — число (1, 2, …), сумма минут за день.
    // Год: 12 месяцев (Янв, Фев, …), сумма минут за календарный месяц.
    let chartData: ChartBar[] = [];

    if (statsPeriod === "day") {
      // День: 24 ячейки по часу для просматриваемой даты (fromByPeriod…toByPeriod).
      const toMs = (t: number) => (t > 1e12 ? t : t * 1000);
      const buckets = new Map<number, number>();
      for (let h = 0; h < 24; h++) buckets.set(h, 0);
      const dayStartMs = fromByPeriod;
      const dayEndMs = toByPeriod;
      for (const s of history) {
        if (s.type !== "focus") continue;
        const start = toMs(s.startedAt);
        const end = toMs(s.endedAt);
        if (end < dayStartMs || start > dayEndMs) continue;
        for (let h = 0; h < 24; h++) {
          const hourStart = dayStartMs + h * HOUR_MS;
          const hourEnd = dayStartMs + (h + 1) * HOUR_MS;
          const overlapMs = Math.max(0, Math.min(end, hourEnd) - Math.max(start, hourStart));
          buckets.set(h, buckets.get(h)! + overlapMs / 60000);
        }
      }
      chartData = Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, "0")}`,
        minutes: Math.round(buckets.get(h)! * 10) / 10,
      }));
    } else if (statsPeriod === "week") {
      // Неделя: 7 календарных дней (ПН–ВС). Сессии распределяются по дню окончания (startOfDay(endedAt)).
      const bucketSec = new Array<number>(7).fill(0);
      const weekStart = fromByPeriod;
      for (const s of history) {
        if (s.type !== "focus") continue;
        if (s.endedAt < weekStart || s.endedAt > toByPeriod) continue;
        const dayIndex = Math.min(6, Math.max(0, Math.floor((startOfDay(s.endedAt) - weekStart) / DAY_MS)));
        bucketSec[dayIndex] += s.durationSec;
      }
      chartData = bucketSec.map((sec, i) => {
        const dayStartMs = fromByPeriod + i * DAY_MS;
        const d = new Date(dayStartMs);
        const label = `${DAY_NAMES_SHORT[i]} ${d.getDate()}`; // «ПН 16», «ВТ 17», …
        return { label, minutes: Math.round((sec / 60) * 10) / 10 };
      });
    } else if (statsPeriod === "month") {
      // Месяц: календарный месяц, столбцов 28–31. Подпись — только число дня (1, 2, … 31).
      // Название месяца (Февраль и т.д.) показывается над блоком «Всего» в UI.
      const monthStart = fromByPeriod;
      const monthEnd = toByPeriod;
      const dFirst = new Date(monthStart);
      const daysInMonth = new Date(dFirst.getFullYear(), dFirst.getMonth() + 1, 0).getDate();
      const bucketSec = new Array<number>(daysInMonth).fill(0);
      for (const s of history) {
        if (s.type !== "focus") continue;
        if (s.endedAt < monthStart || s.endedAt > monthEnd) continue;
        const dayOfMonth = new Date(s.endedAt).getDate();
        bucketSec[dayOfMonth - 1] += s.durationSec;
      }
      chartData = bucketSec.map((sec, i) => {
        const d = new Date(dFirst.getFullYear(), dFirst.getMonth(), i + 1);
        const label = `${d.getDate()}`;
        return { label, minutes: Math.round((sec / 60) * 10) / 10 };
      });
    } else if (statsPeriod === "year") {
      // Год: 12 календарных месяцев с января по декабрь просматриваемого года.
      const monthStarts: number[] = [];
      const yearNum = new Date(fromByPeriod).getFullYear();
      for (let i = 0; i < 12; i++) {
        monthStarts.push(new Date(yearNum, i, 1).getTime());
      }
      const bucketSec = new Array<number>(12).fill(0);
      for (const s of history) {
        if (s.type !== "focus") continue;
        if (s.endedAt < monthStarts[0] || s.endedAt > toByPeriod) continue;
        let i = 0;
        while (i < 11 && s.endedAt >= monthStarts[i + 1]) i++;
        bucketSec[i] += s.durationSec;
      }
      chartData = bucketSec.map((sec, i) => {
        const d = new Date(monthStarts[i]);
        const label = MONTH_NAMES_SHORT[d.getMonth()];
        return { label, minutes: Math.round((sec / 60) * 10) / 10 };
      });
    } else if (statsPeriod === "custom") {
      // Произвольный период: от и до в ms. В зависимости от длины — по дням, неделям или месяцам.
      const from = startOfDay(fromCustom);
      const to = toCustom;
      const rangeDays = (to - from) / DAY_MS;

      if (rangeDays <= ONE_MONTH_DAYS) {
        // До 31 дня — один столбец на календарный день
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
        // От месяца до ~3 месяцев — по календарным неделям (ПН–ВС)
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
        // Больше 3 месяцев — по календарным месяцам
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

    // Заголовки над «Всего»: месяц (Январь, …), год (2025), неделя (17–23 февраля).
    const currentMonthName =
      statsPeriod === "month" ? MONTH_NAMES_FULL[new Date(fromByPeriod).getMonth()] : null;
    const currentYearName =
      statsPeriod === "year" ? String(new Date(fromByPeriod).getFullYear()) : null;
    const currentWeekLabel =
      statsPeriod === "week"
        ? (() => {
            const d1 = new Date(fromByPeriod);
            const d2 = new Date(toByPeriod);
            const fmt = (d: Date) => `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
            return d1.getMonth() === d2.getMonth()
              ? `${d1.getDate()}–${d2.getDate()} ${MONTH_NAMES_SHORT[d1.getMonth()]}`
              : `${fmt(d1)} – ${fmt(d2)}`;
          })()
        : null;

    return {
      todayStats: { minutes: Math.round(dayMinutes / 60), sessionsCount: dayCount },
      weekStats: { minutes: Math.round(weekMinutes / 60), sessionsCount: weekCount },
      currentStats: {
        minutes: Math.round(periodMinutes / 60),
        sessionsCount: periodCount,
      },
      chartData,
      currentMonthName,
      currentYearName,
      currentWeekLabel,
    };
  }, [history, statsPeriod, periodOffset, customStatsFrom, customStatsTo]);

  const canGoNext = periodOffset < 0;
  const showPeriodArrows = statsPeriod !== "custom";

  return {
    statsPeriod,
    setStatsPeriod,
    periodOffset,
    setPeriodOffset,
    canGoNext,
    showPeriodArrows,
    customStatsFrom,
    setCustomStatsFrom,
    customStatsTo,
    setCustomStatsTo,
    todayStats,
    weekStats,
    currentStats,
    chartData,
    currentMonthName,
    currentYearName,
    currentWeekLabel,
  };
}
