export type Session = {
  id: string;
  type: "focus" | "break";
  task: string;
  startedAt: number; // Date.now()
  endedAt: number;   // Date.now()
  durationSec: number;
};

const HISTORY_KEY = "deepwork.history.v1";
const TASK_KEY = "deepwork.task.v1";

export function loadHistory(): Session[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Session[];
  } catch {
    return [];
  }
}

export function saveHistory(items: Session[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export function loadTask(): string {
  return localStorage.getItem(TASK_KEY) ?? "";
}

export function saveTask(task: string) {
  localStorage.setItem(TASK_KEY, task);
}

export function uid() {
  // простая уникалка без библиотек
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type TimeMode = "fixed" | "stopwatch";

const MODE_KEY = "deepwork.timeMode.v1";

export function loadTimeMode(): TimeMode {
  const v = localStorage.getItem(MODE_KEY);
  return v === "stopwatch" ? "stopwatch" : "fixed";
}

export function saveTimeMode(mode: TimeMode) {
  localStorage.setItem(MODE_KEY, mode);
}

export type TimerSnapshot = {
  phase: "focus" | "break";
  running: boolean;
  seconds: number; // fixed: осталось, stopwatch: прошло
  sessionStartedAt: number | null;
  lastUpdatedAt: number; // Date.now() в момент сохранения seconds
};

const FIXED_SNAPSHOT_KEY = "deepwork.timer.fixed.v1";
const STOPWATCH_SNAPSHOT_KEY = "deepwork.timer.stopwatch.v1";

function snapshotKey(mode: TimeMode) {
  return mode === "fixed" ? FIXED_SNAPSHOT_KEY : STOPWATCH_SNAPSHOT_KEY;
}

export function loadTimerSnapshot(mode: TimeMode): TimerSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as TimerSnapshot;
  } catch {
    return null;
  }
}

export function saveTimerSnapshot(mode: TimeMode, snap: TimerSnapshot) {
  localStorage.setItem(snapshotKey(mode), JSON.stringify(snap));
}
