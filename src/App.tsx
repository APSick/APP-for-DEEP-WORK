import { useEffect, useMemo, useState } from "react";
import { getTg } from "./telegram";
import {
  loadHistory,
  loadTask,
  loadTimeMode,
  loadTimerSnapshot,
  saveHistory,
  saveTask,
  saveTimeMode,
  saveTimerSnapshot,
  uid,
  type Session,
  type TimeMode,
  type TimerSnapshot,
} from "./storage";
import "./App.css";

type Phase = "focus" | "break";

const DEFAULT_FOCUS_MIN = 50;
const DEFAULT_BREAK_MIN = 10;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function dayKey(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${y}-${m}-${dd}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function plannedSecFor(phase: Phase, focusMin: number, breakMin: number) {
  return (phase === "focus" ? focusMin : breakMin) * 60;
}

function makeDefaultSnapshot(
  mode: TimeMode,
  focusMin: number,
  breakMin: number,
  phase: Phase = "focus"
): TimerSnapshot {
  const now = Date.now();
  return {
    phase,
    running: false,
    seconds: mode === "fixed" ? plannedSecFor(phase, focusMin, breakMin) : 0,
    sessionStartedAt: null,
    lastUpdatedAt: now,
  };
}

function applySnapshot(
  mode: TimeMode,
  snap: TimerSnapshot,
  focusMin: number,
  breakMin: number
) {
  const now = Date.now();
  const deltaSec = Math.max(0, Math.floor((now - (snap.lastUpdatedAt || now)) / 1000));

  const planned = plannedSecFor(snap.phase, focusMin, breakMin);

  let seconds = snap.seconds ?? (mode === "fixed" ? planned : 0);
  if (mode === "fixed") seconds = Math.min(planned, Math.max(0, seconds));
  else seconds = Math.max(0, seconds);

  let running = !!snap.running;

  if (running) {
    if (mode === "fixed") {
      seconds = Math.max(0, seconds - deltaSec);
      // если ушли и таймер дошёл до 0 — просто стопаем
      if (seconds === 0) running = false;
    } else {
      seconds = seconds + deltaSec;
    }
  }

  // восстановим sessionStartedAt, если вдруг null
  let sessionStartedAt = snap.sessionStartedAt ?? null;
  if (running && sessionStartedAt == null) {
    if (mode === "stopwatch") {
      sessionStartedAt = now - seconds * 1000;
    } else {
      const elapsed = planned - seconds;
      sessionStartedAt = now - Math.max(0, elapsed) * 1000;
    }
  }

  const normalized: TimerSnapshot = {
    phase: snap.phase,
    running,
    seconds,
    sessionStartedAt,
    lastUpdatedAt: now,
  };

  return normalized;
}

export default function App() {
  const [focusMin] = useState(DEFAULT_FOCUS_MIN);
  const [breakMin] = useState(DEFAULT_BREAK_MIN);

  const [timeMode, setTimeMode] = useState<TimeMode>("fixed");
  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(focusMin * 60);

  const [task, setTask] = useState("");
  const [history, setHistory] = useState<Session[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  // Telegram init
  useEffect(() => {
    const tg = getTg();
    tg?.ready();
    tg?.expand();
  }, []);

  // Load persisted state (1 раз)
  useEffect(() => {
    setHistory(loadHistory());
    setTask(loadTask());

    const savedMode = loadTimeMode();
    setTimeMode(savedMode);

    const snap = loadTimerSnapshot(savedMode) ?? makeDefaultSnapshot(savedMode, focusMin, breakMin, "focus");
    const applied = applySnapshot(savedMode, snap, focusMin, breakMin);

    setPhase(applied.phase);
    setRunning(applied.running);
    setSeconds(applied.seconds);
    setSessionStartedAt(applied.sessionStartedAt);

    // сохраняем нормализованное обратно (чтобы lastUpdatedAt стал свежим)
    saveTimerSnapshot(savedMode, applied);
  }, [focusMin, breakMin]);

  // persist task
  useEffect(() => {
    saveTask(task);
  }, [task]);

  // ticker
  useEffect(() => {
    if (!running) return;

    const t = setInterval(() => {
      setSeconds((prev) => {
        if (timeMode === "fixed") return prev <= 1 ? 0 : prev - 1;
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [running, timeMode]);

  // auto-complete only in fixed mode
  useEffect(() => {
    if (timeMode !== "fixed") return;
    if (!running) return;
    if (seconds !== 0) return;

    const endedAt = Date.now();
    const startedAt = sessionStartedAt ?? endedAt;
    const plannedSec = plannedSecFor(phase, focusMin, breakMin);

    const record: Session = {
      id: uid(),
      type: phase,
      task: phase === "focus" ? (task.trim() || "Без названия") : "Перерыв",
      startedAt,
      endedAt,
      durationSec: plannedSec,
    };

    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 200);
      saveHistory(next);
      return next;
    });

    if (phase === "focus") getTg()?.HapticFeedback?.notificationOccurred?.("success");
    else getTg()?.HapticFeedback?.impactOccurred?.("light");

    // переключаем фазу и продолжаем автоматически
    const nextPhase: Phase = phase === "focus" ? "break" : "focus";
    const now = Date.now();
    const nextSeconds = plannedSecFor(nextPhase, focusMin, breakMin);

    setPhase(nextPhase);
    setSeconds(nextSeconds);
    setSessionStartedAt(now);

    const snap: TimerSnapshot = {
      phase: nextPhase,
      running: true,
      seconds: nextSeconds,
      sessionStartedAt: now,
      lastUpdatedAt: now,
    };
    saveTimerSnapshot("fixed", snap);
  }, [seconds, running, timeMode, phase, focusMin, breakMin, task, sessionStartedAt]);

  const displayTime = useMemo(() => fmtTime(seconds), [seconds]);

  const startPhase = (p: Phase) => {
    const now = Date.now();
    const sec = timeMode === "fixed" ? plannedSecFor(p, focusMin, breakMin) : 0;

    setPhase(p);
    setRunning(true);
    setSeconds(sec);
    setSessionStartedAt(now);

    saveTimerSnapshot(timeMode, {
      phase: p,
      running: true,
      seconds: sec,
      sessionStartedAt: now,
      lastUpdatedAt: now,
    });
    saveTimeMode(timeMode);
  };

  const pause = () => {
    const now = Date.now();
    setRunning(false);

    saveTimerSnapshot(timeMode, {
      phase,
      running: false,
      seconds,
      sessionStartedAt,
      lastUpdatedAt: now,
    });
  };

  const resume = () => {
    if (timeMode === "fixed" && seconds === 0) return;

    const now = Date.now();
    const planned = plannedSecFor(phase, focusMin, breakMin);

    const started =
      sessionStartedAt ??
      (timeMode === "stopwatch"
        ? now - seconds * 1000
        : now - Math.max(0, planned - seconds) * 1000);

    setSessionStartedAt(started);
    setRunning(true);

    saveTimerSnapshot(timeMode, {
      phase,
      running: true,
      seconds,
      sessionStartedAt: started,
      lastUpdatedAt: now,
    });
  };

  const reset = () => {
    const now = Date.now();
    setRunning(false);
    setPhase("focus");
    setSessionStartedAt(null);
    setTask("");

    const sec = timeMode === "fixed" ? plannedSecFor("focus", focusMin, breakMin) : 0;
    setSeconds(sec);

    saveTimerSnapshot(timeMode, {
      phase: "focus",
      running: false,
      seconds: sec,
      sessionStartedAt: null,
      lastUpdatedAt: now,
    });
  };

  const finishSession = () => {
    if (!sessionStartedAt) return;

    const endedAt = Date.now();
    const startedAt = sessionStartedAt;
    const planned = plannedSecFor(phase, focusMin, breakMin);

    const durationSec =
      timeMode === "fixed" ? Math.max(0, planned - seconds) : seconds;

    if (durationSec < 5) {
      pause();
      return;
    }

    const record: Session = {
      id: uid(),
      type: phase,
      task: phase === "focus" ? (task.trim() || "Без названия") : "Перерыв",
      startedAt,
      endedAt,
      durationSec,
    };

    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 200);
      saveHistory(next);
      return next;
    });

    getTg()?.HapticFeedback?.notificationOccurred?.("success");

    // переключаем фазу, но не стартуем
    const nextPhase: Phase = phase === "focus" ? "break" : "focus";
    const nextSeconds =
      timeMode === "fixed" ? plannedSecFor(nextPhase, focusMin, breakMin) : 0;

    setPhase(nextPhase);
    setRunning(false);
    setSessionStartedAt(null);
    setSeconds(nextSeconds);

    saveTimerSnapshot(timeMode, {
      phase: nextPhase,
      running: false,
      seconds: nextSeconds,
      sessionStartedAt: null,
      lastUpdatedAt: Date.now(),
    });
  };

  const clearHistory = () => {
    const next: Session[] = [];
    setHistory(next);
    saveHistory(next);
  };

  // ВАЖНО: переключение режима теперь НЕ сбрасывает.
  // Мы сохраняем текущий режим, загружаем другой.
  // Дополнительно: режим, который покидаем, ставим на паузу (чтобы “не бежал в фоне”).
  const switchMode = (m: TimeMode) => {
    const now = Date.now();

    // сохраняем текущий режим (пауза + текущее время)
    saveTimerSnapshot(timeMode, {
      phase,
      running: false,
      seconds,
      sessionStartedAt,
      lastUpdatedAt: now,
    });

    // сохраняем активный режим
    saveTimeMode(m);

    // грузим новый режим
    const snap = loadTimerSnapshot(m) ?? makeDefaultSnapshot(m, focusMin, breakMin, phase);
    const applied = applySnapshot(m, snap, focusMin, breakMin);

    setTimeMode(m);
    setPhase(applied.phase);
    setRunning(applied.running);
    setSeconds(applied.seconds);
    setSessionStartedAt(applied.sessionStartedAt);

    saveTimerSnapshot(m, applied);
  };

  // stats
  const todayStart = startOfToday();
  const todayFocusSec = history
    .filter((s) => s.type === "focus" && s.endedAt >= todayStart)
    .reduce((acc, s) => acc + s.durationSec, 0);

  const todayFocusMin = Math.round(todayFocusSec / 60);
  const lastSessions = history.slice(0, 8);

  return (
    <div className="safe fullHeight app">
      <div className="container">
        <h1 className="title">Deep Work</h1>

        <div className="modeSwitch" role="tablist" aria-label="Time mode">
          <button
            className={`chip ${timeMode === "fixed" ? "chipActive" : ""}`}
            onClick={() => switchMode("fixed")}
          >
            Фикс-таймер
          </button>
          <button
            className={`chip ${timeMode === "stopwatch" ? "chipActive" : ""}`}
            onClick={() => switchMode("stopwatch")}
          >
            Секундомер
          </button>
        </div>

        <div className="statsGrid">
          <Stat label="Фокус сегодня" value={`${todayFocusMin} мин`} />
          <Stat label="Фаза" value={phase === "focus" ? "Фокус" : "Перерыв"} />
          <Stat label="Статус" value={running ? "Идёт" : "Пауза"} />
          <Stat label="Режим" value={timeMode === "fixed" ? "Фикс" : "Секундомер"} />
        </div>

        <label className="field">
          <div className="fieldLabel">Задача на фокус</div>
          <input
            className="input"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder='Напр. "Собрать структуру приложения"'
          />
        </label>

        <div className="panel">
          <div className="muted">
            Сейчас: <b>{phase === "focus" ? "Фокус" : "Перерыв"}</b> •{" "}
            <b>{timeMode === "fixed" ? "осталось" : "прошло"}</b>
          </div>

          <div className="timer">{displayTime}</div>

          <div className="actionsGrid">
            <button className="btn" onClick={() => startPhase("focus")}>
              Старт фокуса ({timeMode === "fixed" ? "50:00" : "0:00"})
            </button>

            <button className="btn" onClick={() => startPhase("break")}>
              Перерыв ({timeMode === "fixed" ? "10:00" : "0:00"})
            </button>

            {!running ? (
              <button className="btn btnPrimary" onClick={resume}>
                Продолжить
              </button>
            ) : (
              <button className="btn btnPrimary" onClick={pause}>
                Пауза
              </button>
            )}

            <button className="btn" onClick={finishSession}>
              Завершить
            </button>

            <button className="btn btnDanger" onClick={reset}>
              Сброс
            </button>
          </div>
        </div>

        <div className="historyHeader">
          <h2 className="h2">История</h2>
          <button className="btn btnDanger" onClick={clearHistory}>
            Очистить
          </button>
        </div>

        {lastSessions.length === 0 ? (
          <div className="muted">Пока пусто — запусти первый фокус 🙂</div>
        ) : (
          <div className="historyList">
            {lastSessions.map((s) => (
              <div key={s.id} className="historyItem">
                <div className="historyTop">
                  <div className="historyTitle">
                    {s.type === "focus" ? "Фокус" : "Перерыв"} •{" "}
                    {Math.round(s.durationSec / 60)} мин
                  </div>
                  <div className="historyTime">{new Date(s.endedAt).toLocaleString()}</div>
                </div>
                <div className="historyTask">{s.task}</div>
                <div className="historyMeta">День: {dayKey(s.endedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}
