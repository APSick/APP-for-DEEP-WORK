// src/components/FocusCard.tsx
import { useState } from "react";
import { TEXTS } from "../constants";
import { fmtMMSS } from "../utils/timer";
import { CustomTimeModal } from "./CustomTimeModal";
import type { Phase, PhaseTimer } from "../storage";
import type { MusicSource } from "../App";

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
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const timerLabel = pt.active === "stopwatch" ? TEXTS.stopwatch : `${pt.countdownMin} ${TEXTS.minutes}`;

  return (
    <>
      <div className="glass card focusCard">
        <div className="cardHeader">
          <div className="cardTitle">{TEXTS.focus}</div>

          <div className="row gap12 headerStatsRow">
            <button className="taskTag taskTagClickable" onClick={() => setMusicMenuOpen((v) => !v)}>
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

          <button className="taskTag taskTagClickable" style={{ marginLeft: "auto" }} onClick={() => setTimerMenuOpen((v) => !v)}>
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

      {/* Модалка «Музыка» в стиле Deep Work */}
      {musicMenuOpen && (
        <div className="overlay" onClick={() => setMusicMenuOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{TEXTS.music}</div>
              <button className="btnOutline" onClick={() => setMusicMenuOpen(false)}>
                {TEXTS.close}
              </button>
            </div>
            <div className="projectsList">
              {([
                { value: "all" as MusicSource, label: TEXTS.musicAll },
                { value: "fav" as MusicSource, label: TEXTS.musicFav },
                { value: "my" as MusicSource,  label: TEXTS.musicMy },
              ] as const).map(({ value, label }) => (
                <div
                  key={value}
                  className={`projectsItem ${musicSource === value ? "projectsItemActive" : ""}`}
                >
                  <button
                    className="projectsPick"
                    onClick={() => {
                      onMusicSourceChange(value);
                      setMusicMenuOpen(false);
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

      {/* Модалка «Таймер» в стиле Deep Work */}
      {timerMenuOpen && (
        <div className="overlay" onClick={() => setTimerMenuOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Режим таймера</div>
              <button className="btnOutline" onClick={() => setTimerMenuOpen(false)}>
                {TEXTS.close}
              </button>
            </div>
            <div className="projectsList">
              <div className={`projectsItem ${pt.active === "stopwatch" ? "projectsItemActive" : ""}`}>
                <button
                  className="projectsPick"
                  onClick={() => {
                    onApplyPreset("stopwatch");
                    setTimerMenuOpen(false);
                  }}
                >
                  {TEXTS.stopwatch}
                </button>
              </div>

              {[15, 25, 45, 60, 90].map((m) => (
                <div
                  key={m}
                  className={`projectsItem ${pt.active === "countdown" && pt.countdownMin === m ? "projectsItemActive" : ""}`}
                >
                  <button
                    className="projectsPick"
                    onClick={() => {
                      onApplyPreset("countdown", m);
                      setTimerMenuOpen(false);
                    }}
                  >
                    {m} {TEXTS.minutes}
                  </button>
                </div>
              ))}

              <div className={`projectsItem ${pt.active === "countdown" && ![15,25,45,60,90].includes(pt.countdownMin) ? "projectsItemActive" : ""}`}>
                <button
                  className="projectsPick"
                  onClick={() => {
                    setCustomOpen(true);
                    setTimerMenuOpen(false);
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
