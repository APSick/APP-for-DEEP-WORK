import { useEffect, useMemo, useState } from "react";
import { getTg } from "./telegram";
import {
  loadHistory,
  loadTask,
  loadTimeMode,
  saveHistory,
  saveTask,
  saveTimeMode,
  uid,
  type Session,
  type TimeMode,
} from "./storage";

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

export default function App() {
  const [focusMin] = useState(DEFAULT_FOCUS_MIN);
  const [breakMin] = useState(DEFAULT_BREAK_MIN);

  const [timeMode, setTimeMode] = useState<TimeMode>("fixed"); // fixed | stopwatch
  const [phase, setPhase] = useState<Phase>("focus");

  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(focusMin * 60); // в fixed = осталось, в stopwatch = прошло

  const [task, setTask] = useState("");
  const [history, setHistory] = useState<Session[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  // telegram init
  useEffect(() => {
    const tg = getTg();
    tg?.ready();
    tg?.expand();
  }, []);

  // load persisted data
  useEffect(() => {
    setHistory(loadHistory());
    setTask(loadTask());
    setTimeMode(loadTimeMode());
  }, []);

  // persist task + mode
  useEffect(() => {
    saveTask(task);
  }, [task]);

  useEffect(() => {
    saveTimeMode(timeMode);
  }, [timeMode]);

  // ensure seconds initialized according to mode/phase
  useEffect(() => {
    if (sessionStartedAt !== null) return; // не мешаем активной/поставленной на паузу сессии
    const planned = (phase === "focus" ? focusMin : breakMin) * 60;
    setSeconds(timeMode === "fixed" ? planned : 0);
  }, [timeMode, phase, focusMin, breakMin, sessionStartedAt]);

  // ticker
  useEffect(() => {
    if (!running) return;

    const t = setInterval(() => {
      setSeconds((prev) => {
        if (timeMode === "fixed") return prev <= 1 ? 0 : prev - 1;
        return prev + 1; // stopwatch
      });
    }, 1000);

    return () => clearInterval(t);
  }, [running, timeMode]);

  // auto complete only in fixed mode
  useEffect(() => {
    if (timeMode !== "fixed") return;
    if (seconds !== 0) return;
    if (!running) return;

    const endedAt = Date.now();
    const startedAt = sessionStartedAt ?? endedAt;
    const plannedSec = (phase === "focus" ? focusMin : breakMin) * 60;

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
    setPhase(nextPhase);
    setSeconds((nextPhase === "focus" ? focusMin : breakMin) * 60);
    setSessionStartedAt(Date.now());
  }, [seconds, running, timeMode, phase, focusMin, breakMin, task, sessionStartedAt]);

  const displayTime = useMemo(() => fmtTime(seconds), [seconds]);

  const plannedForPhaseSec = (phase === "focus" ? focusMin : breakMin) * 60;

  const startPhase = (p: Phase) => {
    setPhase(p);
    setRunning(true);
    setSessionStartedAt(Date.now());
    setSeconds(timeMode === "fixed" ? (p === "focus" ? focusMin : breakMin) * 60 : 0);
  };

  const pause = () => setRunning(false);

  const resume = () => {
    if (timeMode === "fixed" && seconds === 0) return;
    if (!sessionStartedAt) setSessionStartedAt(Date.now());
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setPhase("focus");
    setSessionStartedAt(null);
    setTask("");
    setSeconds(timeMode === "fixed" ? focusMin * 60 : 0);
  };

  const clearHistory = () => {
    const next: Session[] = [];
    setHistory(next);
    saveHistory(next);
  };

  const switchMode = (m: TimeMode) => {
    // при переключении режима — останавливаем и сбрасываем текущую “сессию”
    setRunning(false);
    setSessionStartedAt(null);
    setTimeMode(m);
    const planned = (phase === "focus" ? focusMin : breakMin) * 60;
    setSeconds(m === "fixed" ? planned : 0);
  };

  const finishSession = () => {
    if (!sessionStartedAt) return;

    const endedAt = Date.now();
    const startedAt = sessionStartedAt;

    const durationSec =
      timeMode === "fixed"
        ? Math.max(0, plannedForPhaseSec - seconds) // сколько реально отработал
        : seconds; // секундомер

    // если случайно нажал сразу — не пишем мусор
    if (durationSec < 5) {
      setRunning(false);
      setSessionStartedAt(null);
      setSeconds(timeMode === "fixed" ? plannedForPhaseSec : 0);
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

    // после завершения — переключаем фазу, но не стартуем автоматически
    const nextPhase: Phase = phase === "focus" ? "break" : "focus";
    setPhase(nextPhase);
    setRunning(false);
    setSessionStartedAt(null);
    setSeconds(timeMode === "fixed" ? (nextPhase === "focus" ? focusMin : breakMin) * 60 : 0);
  };

  // stats
  const todayStart = startOfToday();
  const todayFocusSec = history
    .filter((s) => s.type === "focus" && s.endedAt >= todayStart)
    .reduce((acc, s) => acc + s.durationSec, 0);

  const todayFocusMin = Math.round(todayFocusSec / 60);
  const lastSessions = history.slice(0, 8);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ margin: "8px 0 12px" }}>Deep Work</h1>

      {/* СКРОЛЛБАР-ВЫБОР РЕЖИМА */}
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 10,
          marginBottom: 12,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <button onClick={() => switchMode("fixed")} style={chip(timeMode === "fixed")}>
          Фикс-таймер
        </button>
        <button onClick={() => switchMode("stopwatch")} style={chip(timeMode === "stopwatch")}>
          Секундомер
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Stat label="Фокус сегодня" value={`${todayFocusMin} мин`} />
        <Stat label="Фаза" value={phase === "focus" ? "Фокус" : "Перерыв"} />
        <Stat label="Статус" value={running ? "Идёт" : "Пауза"} />
        <Stat
          label="Режим времени"
          value={timeMode === "fixed" ? "Фикс" : "Секундомер"}
        />
      </div>

      <label style={{ display: "block", marginBottom: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Задача на фокус</div>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder='Напр. "Собрать структуру приложения"'
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
          }}
        />
      </label>

      <div
        style={{
          padding: 16,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Сейчас: <b>{phase === "focus" ? "Фокус" : "Перерыв"}</b> •{" "}
          <b>{timeMode === "fixed" ? "осталось" : "прошло"}</b>
        </div>

        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: 1, marginTop: 6 }}>
          {displayTime}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={() => startPhase("focus")} style={btn()}>
            Старт фокуса ({timeMode === "fixed" ? "50:00" : "0:00"})
          </button>
          <button onClick={() => startPhase("break")} style={btn()}>
            Перерыв ({timeMode === "fixed" ? "10:00" : "0:00"})
          </button>

          {!running ? (
            <button onClick={resume} style={btn()}>
              Продолжить
            </button>
          ) : (
            <button onClick={pause} style={btn()}>
              Пауза
            </button>
          )}

          <button onClick={finishSession} style={btn()}>
            Завершить
          </button>

          <button onClick={reset} style={btn(true)}>
            Сброс
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: "10px 0" }}>История</h2>
        <button onClick={clearHistory} style={btn(true)}>
          Очистить
        </button>
      </div>

      {lastSessions.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.75 }}>Пока пусто — запусти первый фокус 🙂</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {lastSessions.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>
                  {s.type === "focus" ? "Фокус" : "Перерыв"} • {Math.round(s.durationSec / 60)} мин
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(s.endedAt).toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>{s.task}</div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                День: {dayKey(s.endedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        padding: "10px 12px",
        minWidth: 140,
        background: "rgba(255,255,255,0.04)",
        color: "white",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: active ? "1px solid rgba(120,180,255,0.8)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(120,180,255,0.18)" : "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  };
}

function btn(danger = false): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: danger ? "1px solid rgba(255, 90, 90, 0.35)" : "1px solid rgba(255,255,255,0.18)",
    background: danger ? "rgba(255,0,0,0.14)" : "rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  };
}
