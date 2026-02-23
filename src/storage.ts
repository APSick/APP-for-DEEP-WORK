// src/storage.ts
/**
 * Хранилище привязано к пользователю: в Telegram — к Telegram user id,
 * вне Telegram — к ключу "anon". Один и тот же аккаунт на разных устройствах
 * видит одну и ту же историю (по id пользователя Telegram).
 */
import { getTg } from "./telegram";

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
const LEGACY_TIME_KEYS = ["dw_time_v1", "dw_time_mode_v1", "dw_time_v0"];

/** Идентификатор пользователя для ключей: tg_<id> в Telegram, иначе anon (локальное устройство) */
function getStorageUserId(): string {
  const tg = getTg();
  const id = tg?.initDataUnsafe?.user?.id;
  if (id != null && Number.isFinite(id)) return `tg_${id}`;
  return "anon";
}

/** Ключ localStorage с привязкой к текущему пользователю */
function userKey(base: string): string {
  return `${base}_${getStorageUserId()}`;
}

/**
 * Проверяет доступность localStorage в текущем окружении
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const test = "__localStorage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Безопасное получение значения из localStorage
 */
function safeGetItem(key: string): string | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Безопасное сохранение значения в localStorage
 */
function safeSetItem(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

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

function isValidSession(x: unknown): x is Session {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.type === "focus" || o.type === "break") &&
    typeof o.startedAt === "number" &&
    Number.isFinite(o.startedAt) &&
    typeof o.endedAt === "number" &&
    Number.isFinite(o.endedAt) &&
    typeof o.durationSec === "number" &&
    Number.isFinite(o.durationSec) &&
    o.durationSec >= 0
  );
}

/** Старые данные могли сохранять время в секундах — приводим к миллисекундам */
function normalizeSession(s: Session): Session {
  const toMs = (t: number) => (t > 1e12 ? t : t * 1000);
  return {
    ...s,
    startedAt: toMs(s.startedAt),
    endedAt: toMs(s.endedAt),
  };
}

export function loadHistory(): Session[] {
  const key = userKey(KEY_HISTORY);
  let v = safeJsonParse<unknown>(safeGetItem(key));
  if (!Array.isArray(v) && getStorageUserId() === "anon") {
    const legacy = safeJsonParse<unknown>(safeGetItem(KEY_HISTORY));
    if (Array.isArray(legacy)) {
      v = legacy;
      safeSetItem(key, JSON.stringify(v));
      try {
        localStorage.removeItem(KEY_HISTORY);
      } catch {
        /* ignore */
      }
    }
  }
  if (!Array.isArray(v)) return [];
  return v.filter(isValidSession).map(normalizeSession);
}

export function saveHistory(items: Session[]) {
  safeSetItem(userKey(KEY_HISTORY), JSON.stringify(items));
}

export function loadTask(): string {
  const key = userKey(KEY_TASK);
  let v = safeGetItem(key);
  if (v === null && getStorageUserId() === "anon") {
    v = safeGetItem(KEY_TASK);
    if (v !== null) {
      safeSetItem(key, v);
      try {
        localStorage.removeItem(KEY_TASK);
      } catch {
        /* ignore */
      }
    }
  }
  return v ?? "";
}

export function saveTask(task: string) {
  safeSetItem(userKey(KEY_TASK), task ?? "");
}

function isValidProject(x: unknown): x is Project {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.name === "string";
}

export function loadProjects(): Project[] {
  const key = userKey(KEY_PROJECTS);
  let v = safeJsonParse<unknown>(safeGetItem(key));
  if (!Array.isArray(v) && getStorageUserId() === "anon") {
    const legacy = safeJsonParse<unknown>(safeGetItem(KEY_PROJECTS));
    if (Array.isArray(legacy)) {
      v = legacy;
      safeSetItem(key, JSON.stringify(v));
      try {
        localStorage.removeItem(KEY_PROJECTS);
      } catch {
        /* ignore */
      }
    }
  }
  if (!Array.isArray(v)) return [];
  const filtered = v.filter(isValidProject);
  if (filtered.length > 0) return filtered;

  const def: Project[] = [
    { id: "deep-work", name: "Deep Work" },
    { id: "creative", name: "Креатив" },
    { id: "study", name: "Учёба" },
    { id: "reading", name: "Чтение" },
    { id: "training", name: "Тренировка" },
    { id: "other", name: "Другое" },
  ];
  safeSetItem(key, JSON.stringify(def));
  safeSetItem(userKey(KEY_ACTIVE_PROJECT), def[0].id);
  return def;
}

export function saveProjects(items: Project[]) {
  safeSetItem(userKey(KEY_PROJECTS), JSON.stringify(items));
}

export function loadActiveProjectId(): string {
  const key = userKey(KEY_ACTIVE_PROJECT);
  let v = safeGetItem(key);
  if (v === null && getStorageUserId() === "anon") {
    v = safeGetItem(KEY_ACTIVE_PROJECT);
    if (v !== null) {
      safeSetItem(key, v);
      try {
        localStorage.removeItem(KEY_ACTIVE_PROJECT);
      } catch {
        /* ignore */
      }
    }
  }
  return v ?? "";
}

export function saveActiveProjectId(id: string) {
  safeSetItem(userKey(KEY_ACTIVE_PROJECT), id);
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

export function defaultPhaseTimer(min: number, active: TimerKind = "stopwatch"): PhaseTimer {
  return {
    active,
    countdownMin: min,
    stopwatch: { running: false, baseSec: 0, startedAt: null },
    countdown: { running: false, baseRemainingSec: min * 60, startedAt: null, durationMin: min },
  };
}

export function loadTimeMode(): TimeModeSnapshotV2 | null {
  const key = userKey(KEY_TIME);
  const v2 = safeJsonParse<TimeModeSnapshotV2>(safeGetItem(key));
  if (v2?.v === 2) return v2;

  let legacyRaw: string | null = null;
  for (const k of LEGACY_TIME_KEYS) {
    const v = safeGetItem(k);
    if (v) {
      legacyRaw = v;
      break;
    }
  }
  if (!legacyRaw) legacyRaw = safeGetItem(key);
  if (!legacyRaw) legacyRaw = safeGetItem(KEY_TIME);

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

  saveTimeMode(snap);
  return snap;
}

export function saveTimeMode(snapshot: TimeModeSnapshotV2) {
  safeSetItem(userKey(KEY_TIME), JSON.stringify(snapshot));
}

export function clampInt(n: number, min: number, max: number): number {
  const x = Math.trunc(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}
