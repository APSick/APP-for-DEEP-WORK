// src/storage.ts
export type Phase = "focus" | "break";

export type Session = {
  id: string;
  type: Phase;
  task?: string;
  startedAt: number; // ms
  endedAt: number; // ms
  durationSec: number;
  projectId?: string;
  projectName?: string;
};

export type TimerKind = "stopwatch" | "countdown";

export type StopwatchTrack = {
  running: boolean;
  baseSec: number; // накопленное время на паузе
  startedAt: number | null; // ms, когда нажали "старт/продолжить"
};

export type CountdownTrack = {
  running: boolean;
  baseRemainingSec: number; // остаток на паузе
  startedAt: number | null; // ms
  durationMin: number; // выбранная длительность
};

export type PhaseTimer = {
  active: TimerKind; // что выбрано сейчас
  countdownMin: number; // выбранные минуты (если countdown)
  stopwatch: StopwatchTrack;
  countdown: CountdownTrack;
};

export type TimeModeSnapshotV2 = {
  v: 2;
  phase: Phase;
  focus: PhaseTimer;
  break: PhaseTimer;
};

export type Project = { id: string; name: string };

const KEY_HISTORY = "dw_history_v1";
const KEY_TASK = "dw_task_v1";

const KEY_PROJECTS = "dw_projects_v1";
const KEY_ACTIVE_PROJECT = "dw_active_project_v1";

const KEY_TIME = "dw_time_mode_v2";
// старый ключ (если у тебя раньше было другое имя — это ок, мы мигрируем по структуре)
const LEGACY_TIME_KEYS = ["dw_time_v1", "dw_time_mode_v1", "dw_time_v0"];

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function uid(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function loadHistory(): Session[] {
  const v = safeJsonParse<Session[]>(localStorage.getItem(KEY_HISTORY));
  return Array.isArray(v) ? v : [];
}

export function saveHistory(items: Session[]) {
  localStorage.setItem(KEY_HISTORY, JSON.stringify(items));
}

export function loadTask(): string {
  return localStorage.getItem(KEY_TASK) ?? "";
}

export function saveTask(task: string) {
  localStorage.setItem(KEY_TASK, task ?? "");
}

export function loadProjects(): Project[] {
  const v = safeJsonParse<Project[]>(localStorage.getItem(KEY_PROJECTS));
  if (Array.isArray(v) && v.length) return v;

  // дефолтный набор как на твоих скринах
  const def: Project[] = [
    { id: "deep-work", name: "Deep Work" },
    { id: "creative", name: "Креатив" },
    { id: "study", name: "Учёба" },
    { id: "reading", name: "Чтение" },
    { id: "training", name: "Тренировка" },
    { id: "other", name: "Другое" },
  ];
  localStorage.setItem(KEY_PROJECTS, JSON.stringify(def));
  localStorage.setItem(KEY_ACTIVE_PROJECT, def[0].id);
  return def;
}

export function saveProjects(items: Project[]) {
  localStorage.setItem(KEY_PROJECTS, JSON.stringify(items));
}

export function loadActiveProjectId(): string {
  return localStorage.getItem(KEY_ACTIVE_PROJECT) ?? "";
}

export function saveActiveProjectId(id: string) {
  localStorage.setItem(KEY_ACTIVE_PROJECT, id);
}

/**
 * Миграция со старого формата (если он у тебя уже лежит в localStorage).
 * Старый формат был примерно таким:
 * { mode: "fixed"|"stopwatch", fixedFocusMin, fixedBreakMin, elapsedSec, remainingSec, isRunning, phase, startedAt? }
 */
type LegacyTimeSnapshot = {
  mode: "fixed" | "stopwatch";
  fixedFocusMin?: number;
  fixedBreakMin?: number;
  elapsedSec?: number;
  remainingSec?: number;
  isRunning?: boolean;
  phase?: Phase;
  startedAt?: number;
};

function defaultPhaseTimer(min: number, active: TimerKind = "stopwatch"): PhaseTimer {
  return {
    active,
    countdownMin: min,
    stopwatch: { running: false, baseSec: 0, startedAt: null },
    countdown: { running: false, baseRemainingSec: min * 60, startedAt: null, durationMin: min },
  };
}

export function loadTimeMode(): TimeModeSnapshotV2 | null {
  // новый ключ
  const v2 = safeJsonParse<TimeModeSnapshotV2>(localStorage.getItem(KEY_TIME));
  if (v2?.v === 2) return v2;

  // пробуем найти legacy
  let legacyRaw: string | null = null;
  for (const k of LEGACY_TIME_KEYS) {
    const v = localStorage.getItem(k);
    if (v) {
      legacyRaw = v;
      break;
    }
  }
  // иногда legacy могли сохранить и под KEY_TIME, но без v:2
  if (!legacyRaw) legacyRaw = localStorage.getItem(KEY_TIME);

  const legacy = safeJsonParse<LegacyTimeSnapshot>(legacyRaw);
  if (!legacy || (legacy.mode !== "fixed" && legacy.mode !== "stopwatch")) return null;

  const focusMin = clampInt(legacy.fixedFocusMin ?? 45, 1, 240);
  const breakMin = clampInt(legacy.fixedBreakMin ?? 15, 1, 240);

  const focus = defaultPhaseTimer(focusMin, legacy.mode === "stopwatch" ? "stopwatch" : "countdown");
  const brk = defaultPhaseTimer(breakMin, "countdown");

  // восстановим прогресс
  if (legacy.mode === "stopwatch") {
    focus.stopwatch.baseSec = Math.max(0, legacy.elapsedSec ?? 0);
    if (legacy.isRunning) {
      focus.stopwatch.running = true;
      focus.stopwatch.startedAt = Date.now(); // продолжаем “с текущего”
    }
  } else {
    focus.countdown.durationMin = focusMin;
    focus.countdown.baseRemainingSec = Math.max(0, legacy.remainingSec ?? focusMin * 60);
    if (legacy.isRunning) {
      focus.countdown.running = true;
      focus.countdown.startedAt = Date.now();
    }
  }

  const snap: TimeModeSnapshotV2 = {
    v: 2,
    phase: legacy.phase ?? "focus",
    focus,
    break: brk,
  };

  // сохраним уже в новом формате
  saveTimeMode(snap);
  return snap;
}

export function saveTimeMode(snapshot: TimeModeSnapshotV2) {
  localStorage.setItem(KEY_TIME, JSON.stringify(snapshot));
}

export function clampInt(n: number, min: number, max: number): number {
  const x = Math.trunc(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}
