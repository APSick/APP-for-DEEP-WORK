// src/components/FocusCard.tsx
import { useState } from "react";
import { TEXTS } from "../constants";
import { fmtMMSS } from "../utils/timer";
import { CustomTimeModal } from "./CustomTimeModal";
import type { Phase, PhaseTimer } from "../storage";
import type { MusicSource } from "../App";

const COUNTDOWN_PRESETS = [15, 25, 45, 60, 90] as const;

interface FocusCardProps {
  phase: Phase;
  pt: PhaseTimer;
  displaySec: number;
  isRunning: boolean;
  task: string;
  activeProjectName: string;
  todayStats: { minutes: number };
  weekStats: { minutes: number };
  musicSource: MusicSource;
  onTaskChange: (task: string) => void;
  onTogglePhase: () => void;
  onStartPause: () => void;
  onReset: () => void;
  onFinish: () => void;
  onApplyPreset: (kind: "stopwatch" | "countdown", minutes?: number) => void;
  onOpenProjects: () => void;
  onMusicSourceChange: (source: MusicSource) => void;
}

export function FocusCard({
  phase,
  pt,
  displaySec,
  isRunning,
  task,
  activeProjectName,
  todayStats,
  weekStats,
  musicSource,
  onTaskChange,
  onTogglePhase,
  onStartPause,
  onReset,
  onFinish,
  onApplyPreset,
  onOpenProjects,
  onMusicSourceChange,
}: FocusCardProps) {
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const timerLabel = pt.active === "stopwatch" ? TEXTS.stopwatch : `${pt.countdownMin} ${TEXTS.minutes}`;
  const isCustomCountdown =
    pt.active === "countdown" && !COUNTDOWN_PRESETS.includes(pt.countdownMin as (typeof COUNTDOWN_PRESETS)[number]);

  return (
    <>
      <div className="glass card focusCard">
        <div className="cardHeader">
          <div className="cardTitle">{TEXTS.focus}</div>

          <div className="row gap12 headerStatsRow">
            <button
              className="taskTag taskTagClickable"
              onClick={() => setMusicModalOpen(true)}
            >
              {musicSource === "fav"
                ? TEXTS.musicFav
                : musicSource === "all"
                  ? TEXTS.musicAll
                  : TEXTS.musicMy}{" "}
              ▼
            </button>

            <div className="miniStatsGroup">
              <div className="miniStat">
                <div className="miniStatLabel">{TEXTS.statsToday}</div>
                <div className="miniStatValue">{todayStats.minutes ? `${todayStats.minutes}м` : "—"}</div>
              </div>
              <div className="miniStat">
                <div className="miniStatLabel">{TEXTS.statsWeek}</div>
                <div className="miniStatValue">{weekStats.minutes ? `${weekStats.minutes}м` : "—"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="taskRow">
          <input
            className="taskInput"
            placeholder={TEXTS.taskPlaceholder}
            value={task}
            onChange={(e) => onTaskChange(e.target.value)}
          />

          <button className="taskTag taskTagClickable" onClick={onOpenProjects} title={TEXTS.projectsSelect}>
            {activeProjectName || TEXTS.defaultProjects.deepWork} ▼
          </button>
        </div>

        <div className="row gap12">
          <button className="modeInfo modeInfoBtn" onClick={onTogglePhase}>
            <span className="modeInfoText">{phase === "focus" ? TEXTS.focusMode : TEXTS.break}</span>
          </button>

          <button
            className="taskTag taskTagClickable"
            style={{ marginLeft: "auto" }}
            onClick={() => setTimerModalOpen(true)}
          >
            {timerLabel} ▼
          </button>
        </div>

        <div className="centerArea">
          <div className={`ring ${isRunning ? "ringActive" : ""}`}>
            <button className="ringButton" onClick={onStartPause}>
              <div className="ringLabel">{isRunning ? TEXTS.pause : TEXTS.start}</div>
              <div className="ringTime">{fmtMMSS(displaySec)}</div>
              <div className="ringSub">{pt.active === "stopwatch" ? TEXTS.elapsed : TEXTS.remaining}</div>
            </button>
          </div>

          <div className="actionsRow">
            <button className="btnGhost" onClick={onFinish} disabled={!isRunning && displaySec === 0}>
              {TEXTS.finish}
            </button>
            <button className="btnDanger" onClick={onReset}>
              {TEXTS.reset}
            </button>
          </div>
        </div>
      </div>

      {customOpen && (
        <CustomTimeModal
          isOpen={customOpen}
          currentMinutes={pt.countdownMin}
          onSave={(m) => {
            onApplyPreset("countdown", m);
            setCustomOpen(false);
          }}
          onClose={() => setCustomOpen(false)}
        />
      )}

      {/* Модалка: источник музыки */}
      {musicModalOpen && (
        <div className="overlay" onClick={() => setMusicModalOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{TEXTS.music}</div>
              <button className="btnOutline" onClick={() => setMusicModalOpen(false)}>
                {TEXTS.close}
              </button>
            </div>
            <div className="projectsList modalList">
              {(
                [
                  { value: "all" as const, label: TEXTS.musicAll },
                  { value: "fav" as const, label: TEXTS.musicFav },
                  { value: "my" as const, label: TEXTS.musicMy },
                ] as const
              ).map(({ value, label }) => (
                <div
                  key={value}
                  className={`projectsItem ${musicSource === value ? "projectsItemActive" : ""}`}
                >
                  <button
                    className="projectsPick"
                    onClick={() => {
                      onMusicSourceChange(value);
                      setMusicModalOpen(false);
                    }}
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Модалка: режим таймера (Секундомер / минуты) */}
      {timerModalOpen && (
        <div className="overlay" onClick={() => setTimerModalOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{TEXTS.stopwatch}</div>
              <button className="btnOutline" onClick={() => setTimerModalOpen(false)}>
                {TEXTS.close}
              </button>
            </div>
            <div className="projectsList modalList">
              <div
                className={`projectsItem ${pt.active === "stopwatch" ? "projectsItemActive" : ""}`}
              >
                <button
                  className="projectsPick"
                  onClick={() => {
                    onApplyPreset("stopwatch");
                    setTimerModalOpen(false);
                  }}
                >
                  {TEXTS.stopwatch}
                </button>
              </div>
              {COUNTDOWN_PRESETS.map((m) => (
                <div
                  key={m}
                  className={`projectsItem ${pt.active === "countdown" && pt.countdownMin === m ? "projectsItemActive" : ""}`}
                >
                  <button
                    className="projectsPick"
                    onClick={() => {
                      onApplyPreset("countdown", m);
                      setTimerModalOpen(false);
                    }}
                  >
                    {m} {TEXTS.minutes}
                  </button>
                </div>
              ))}
              <div
                className={`projectsItem ${customOpen || isCustomCountdown ? "projectsItemActive" : ""}`}
              >
                <button
                  className="projectsPick"
                  onClick={() => {
                    setTimerModalOpen(false);
                    setCustomOpen(true);
                  }}
                >
                  {TEXTS.custom}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
