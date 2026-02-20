// src/utils/timer.ts
// Утилиты для работы с таймером

import type { PhaseTimer } from "../storage";

export function fmtMMSS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function calcStopwatchSec(track: PhaseTimer["stopwatch"], nowMs: number): number {
  if (!track.running || !track.startedAt) return track.baseSec;
  return track.baseSec + Math.floor((nowMs - track.startedAt) / 1000);
}

export function calcCountdownRemaining(track: PhaseTimer["countdown"], nowMs: number): number {
  let rem = track.baseRemainingSec;
  if (track.running && track.startedAt) {
    rem = rem - Math.floor((nowMs - track.startedAt) / 1000);
  }
  return Math.max(0, rem);
}
