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
            <div className="dropdownWrap">
              <button className="pillButton" onClick={() => setMusicMenuOpen((v) => !v)}>
                <span className="pillText">
                  {musicSource === "fav"
                    ? TEXTS.musicFav
                    : musicSource === "all"
                    ? TEXTS.musicAll
                    : TEXTS.musicMy}
                </span>
                <span className="caret">▼</span>
              </button>

              {musicMenuOpen && (
                <div className="glassMenu">
                  <div className="menu">
                    <button
                      className={`menuItem ${musicSource === "all" ? "menuActive" : ""}`}
                      onClick={() => {
                        onMusicSourceChange("all");
                        setMusicMenuOpen(false);
                      }}
                    >
                      <span className="check">{musicSource === "all" ? "✓" : ""}</span>
                      {TEXTS.musicAll}
                    </button>
                    <button
                      className={`menuItem ${musicSource === "fav" ? "menuActive" : ""}`}
                      onClick={() => {
                        onMusicSourceChange("fav");
                        setMusicMenuOpen(false);
                      }}
                    >
                      <span className="check">{musicSource === "fav" ? "✓" : ""}</span>
                      {TEXTS.musicFav}
                    </button>
                    <button
                      className={`menuItem ${musicSource === "my" ? "menuActive" : ""}`}
                      onClick={() => {
                        onMusicSourceChange("my");
                        setMusicMenuOpen(false);
                      }}
                    >
                      <span className="check">{musicSource === "my" ? "✓" : ""}</span>
                      {TEXTS.musicMy}
                    </button>
                  </div>
                </div>
              )}
            </div>

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

          <div className="dropdownWrap" style={{ marginLeft: "auto" }}>
            <button className="pillButton" onClick={() => setTimerMenuOpen((v) => !v)}>
              <span className="pillText">{timerLabel}</span>
              <span className="caret">▼</span>
            </button>

            {timerMenuOpen && (
              <div className="sheetBackdrop" onClick={() => setTimerMenuOpen(false)}>
                <div className="timeMenuSheet" onClick={(e) => e.stopPropagation()}>
                  <div className="timeMenuTitle">{TEXTS.stopwatch}</div>

                  <div className="timeMenuList">
                    <button
                      className={`menuItem ${pt.active === "stopwatch" ? "menuActive" : ""}`}
                      onClick={() => {
                        onApplyPreset("stopwatch");
                        setTimerMenuOpen(false);
                      }}
                    >
                      <span className="check">{pt.active === "stopwatch" ? "✓" : ""}</span>
                      {TEXTS.stopwatch}
                    </button>

                    {[15, 25, 45, 60, 90].map((m) => (
                      <button
                        key={m}
                        className={`menuItem ${pt.active === "countdown" && pt.countdownMin === m ? "menuActive" : ""}`}
                        onClick={() => {
                          onApplyPreset("countdown", m);
                          setTimerMenuOpen(false);
                        }}
                      >
                        <span className="check">{pt.active === "countdown" && pt.countdownMin === m ? "✓" : ""}</span>
                        {m} {TEXTS.minutes}
                      </button>
                    ))}

                    <button
                      className={`menuItem ${customOpen ? "menuActive" : ""}`}
                      onClick={() => {
                        setCustomOpen(true);
                        setTimerMenuOpen(false);
                      }}
                    >
                      <span className="check">{customOpen ? "✓" : ""}</span>
                      {TEXTS.custom}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
    </>
  );
}
