import { useEffect, useMemo, useState } from "react";
import { getTg } from "./telegram";
import { loadHistory, loadTask, saveHistory, saveTask, Session, uid } from "./storage";

type Phase = "focus" | "break";

const DEFAULT_FOCUS_MIN = 50;
const DEFAULT_BREAK_MIN = 10;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad(m)}:${pad(s)}`;
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

  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(focusMin * 60);

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
  }, []);

  // persist task draft
  useEffect(() => {
    saveTask(task);
  }, [task]);

  // ticker
  useEffect(() => {
    if (!running) return;

    const t = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [running]);

  // when timer hits 0 -> save session + switch phase
  useEffect(() => {
    if (secondsLeft !== 0) return;
    if (!running) return;

    // фиксируем завершение текущей фазы
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
      const next = [record, ...prev].slice(0, 200); // храним последние 200
      saveHistory(next);
      return next;
    });

    // вибрация в Telegram (если открыто как mini app)
    if (phase === "focus") getTg()?.HapticFeedback?.notificationOccurred?.("success");
    else getTg()?.HapticFeedback?.impactOccurred?.("light");

    // переключаем фазу
    if (phase === "focus") {
      setPhase("break");
      setSecondsLeft(breakMin * 60);
    } else {
      setPhase("focus");
      setSecondsLeft(focusMin * 60);
    }

    setSessionStartedAt(Date.now());
  }, [secondsLeft, running, phase, focusMin, breakMin, task, sessionStartedAt]);

  const mmss = useMemo(() => fmtMMSS(secondsLeft), [secondsLeft]);

  const startFocus = () => {
    setPhase("focus");
    setSecondsLeft(focusMin * 60);
    setSessionStartedAt(Date.now());
    setRunning(true);
  };

  const startBreak = () => {
    setPhase("break");
    setSecondsLeft(breakMin * 60);
    setSessionStartedAt(Date.now());
    setRunning(true);
  };

  const pause = () => setRunning(false);
  const resume = () => {
    if (secondsLeft === 0) return;
    if (!sessionStartedAt) setSessionStartedAt(Date.now());
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setPhase("focus");
    setSecondsLeft(focusMin * 60);
    setSessionStartedAt(null);
    setTask("");
  };

  const clearHistory = () => {
    const next: Session[] = [];
    setHistory(next);
    saveHistory(next);
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

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Stat label="Фокус сегодня" value={`${todayFocusMin} мин`} />
        <Stat label="Фаза" value={phase === "focus" ? "Фокус" : "Перерыв"} />
        <Stat label="Статус" value={running ? "Идёт" : "Пауза"} />
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
            border: "1px solid rgba(0,0,0,0.15)",
          }}
        />
      </label>

      <div
        style={{
          padding: 16,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Сейчас: <b>{phase === "focus" ? "Фокус" : "Перерыв"}</b>
        </div>

        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: 1, marginTop: 6 }}>
          {mmss}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={startFocus} style={btn()}>
            Старт фокуса (50:00)
          </button>
          <button onClick={startBreak} style={btn()}>
            Перерыв (10:00)
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
                border: "1px solid rgba(0,0,0,0.12)",
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
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 14,
        padding: "10px 12px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function btn(danger = false): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: danger ? "rgba(255,0,0,0.06)" : "white",
    cursor: "pointer",
  };
}
