// src/hooks/useTimer.ts
import { useEffect, useState } from "react";
import {
  defaultPhaseTimer,
  loadTimeMode,
  saveTimeMode,
  type Phase,
  type PhaseTimer,
  type TimeModeSnapshotV2,
  type TimerKind,
} from "../storage";
import { calcCountdownRemaining, calcStopwatchSec } from "../utils/timer";

export function useTimer() {
  const [phase, setPhase] = useState<Phase>("focus");
  const [timers, setTimers] = useState<{ focus: PhaseTimer; break: PhaseTimer }>(() => {
    const snap = loadTimeMode();
    if (snap?.v === 2) return { focus: snap.focus, break: snap.break };
    return { focus: defaultPhaseTimer(45, "stopwatch"), break: defaultPhaseTimer(15, "countdown") };
  });

  // Сохранение в localStorage
  useEffect(() => {
    const snap: TimeModeSnapshotV2 = { v: 2, phase, focus: timers.focus, break: timers.break };
    saveTimeMode(snap);
  }, [phase, timers]);

  // Тик времени
  const [nowMs, setNowMs] = useState(() => Date.now());

  const anyRunning =
    timers.focus.stopwatch.running ||
    timers.focus.countdown.running ||
    timers.break.stopwatch.running ||
    timers.break.countdown.running;

  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const pt = timers[phase];
  const elapsed = calcStopwatchSec(pt.stopwatch, nowMs);
  const remaining = calcCountdownRemaining(pt.countdown, nowMs);

  const displaySec = pt.active === "stopwatch" ? elapsed : remaining;
  const isRunning = pt.active === "stopwatch" ? pt.stopwatch.running : pt.countdown.running;

  function pauseAll() {
    const t = Date.now();
    setTimers((prev) => {
      const next = { ...prev };
      (["focus", "break"] as const).forEach((ph) => {
        const p = prev[ph];
        const swSec = calcStopwatchSec(p.stopwatch, t);
        const cdRem = calcCountdownRemaining(p.countdown, t);

        next[ph] = {
          ...p,
          stopwatch: { running: false, baseSec: swSec, startedAt: null },
          countdown: { ...p.countdown, running: false, baseRemainingSec: cdRem, startedAt: null },
        };
      });
      return next;
    });
  }

  function togglePhase() {
    pauseAll();
    setPhase((p) => (p === "focus" ? "break" : "focus"));
  }

  function startPause() {
    const t = Date.now();
    setTimers((prev) => {
      const cur = prev[phase];

      if (cur.active === "stopwatch") {
        const curSec = calcStopwatchSec(cur.stopwatch, t);
        const running = cur.stopwatch.running;

        const nextSw = running
          ? { running: false, baseSec: curSec, startedAt: null }
          : { running: true, baseSec: curSec, startedAt: t };

        return { ...prev, [phase]: { ...cur, stopwatch: nextSw } };
      }

      // countdown
      const curRem = calcCountdownRemaining(cur.countdown, t);
      const running = cur.countdown.running;

      if (running) {
        return {
          ...prev,
          [phase]: {
            ...cur,
            countdown: { ...cur.countdown, running: false, baseRemainingSec: curRem, startedAt: null },
          },
        };
      }

      const startFrom = curRem <= 0 ? cur.countdown.durationMin * 60 : curRem;

      return {
        ...prev,
        [phase]: {
          ...cur,
          countdown: { ...cur.countdown, running: true, baseRemainingSec: startFrom, startedAt: t },
        },
      };
    });
  }

  function resetCurrent() {
    pauseAll();
    setTimers((prev) => {
      const cur = prev[phase];
      if (cur.active === "stopwatch") {
        return {
          ...prev,
          [phase]: { ...cur, stopwatch: { running: false, baseSec: 0, startedAt: null } },
        };
      }
      return {
        ...prev,
        [phase]: {
          ...cur,
          countdown: {
            ...cur.countdown,
            running: false,
            baseRemainingSec: cur.countdown.durationMin * 60,
            startedAt: null,
          },
        },
      };
    });
  }

  function applyPreset(kind: TimerKind, minutes?: number) {
    pauseAll();

    if (kind === "stopwatch") {
      setTimers((prev) => {
        const cur = prev[phase];
        return { ...prev, [phase]: { ...cur, active: "stopwatch" } };
      });
      return;
    }

    const m = minutes ?? pt.countdownMin;

    setTimers((prev) => {
      const cur = prev[phase];
      return {
        ...prev,
        [phase]: {
          ...cur,
          active: "countdown",
          countdownMin: m,
          countdown: { running: false, baseRemainingSec: m * 60, startedAt: null, durationMin: m },
        },
      };
    });
  }

  return {
    phase,
    timers,
    pt,
    displaySec,
    isRunning,
    togglePhase,
    startPause,
    resetCurrent,
    applyPreset,
    pauseAll,
    nowMs,
    setPhase,
    setTimers,
  };
}
