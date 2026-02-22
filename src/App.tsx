// src/App.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { getTg } from "./telegram";
import { loadHistory, loadTask, saveHistory, saveTask, uid, type Session } from "./storage";
import { useTimer } from "./hooks/useTimer";
import { useProjects } from "./hooks/useProjects";
import { useStats } from "./hooks/useStats";
import { TopBar } from "./components/TopBar";
import { BottomNav } from "./components/BottomNav";
import { FocusCard } from "./components/FocusCard";
import { StatsCard } from "./components/StatsCard";
import { ProjectsModal } from "./components/ProjectsModal";
import { TEXTS } from "./constants";
import { calcCountdownRemaining } from "./utils/timer";

type Tab = "focus" | "music" | "stats" | "profile";
export type MusicSource = "all" | "fav" | "my";

export default function App() {
  const tg = useMemo(() => getTg(), []);

  useEffect(() => {
    try {
      tg?.ready?.();
      tg?.expand?.();
    } catch {
      // ignore
    }
  }, [tg]);

  // ===== Navigation =====
  const [tab, setTab] = useState<Tab>("focus");
  const [musicSource, setMusicSource] = useState<MusicSource>("fav");
  const [projectsOpen, setProjectsOpen] = useState(false);

  // ===== Task =====
  const [task, setTask] = useState(() => loadTask());
  useEffect(() => saveTask(task), [task]);

  // ===== Projects =====
  const {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    addProject,
    renameProject,
    deleteProject,
  } = useProjects();

  // ===== History =====
  const [history, setHistory] = useState<Session[]>(() => loadHistory());
  useEffect(() => saveHistory(history), [history]);

  // ===== Timer =====
  const timer = useTimer();
  const { phase, pt, displaySec, isRunning, nowMs, timers, pauseAll, resetCurrent } = timer;

  // ===== Stats =====
  const stats = useStats(history);

  // ===== Finish session handler =====
  const handleFinishSession = useCallback(() => {
    const t = Date.now();
    const cur = timers[phase];
    const durSec =
      cur.active === "stopwatch"
        ? timer.displaySec
        : cur.countdown.durationMin * 60 - calcCountdownRemaining(cur.countdown, t);

    pauseAll();

    if (durSec <= 0) return;

    const proj = projects.find((p) => p.id === activeProjectId);
    const endedAt = t;
    const startedAt = endedAt - durSec * 1000;

    const s: Session = {
      id: uid(),
      type: phase,
      task: task?.trim() ? task.trim() : undefined,
      startedAt,
      endedAt,
      durationSec: durSec,
      projectId: proj?.id,
      projectName: proj?.name,
    };

    setHistory((h) => [s, ...h].slice(0, 2000));
    setTimeout(() => resetCurrent(), 0);
  }, [
    phase,
    timers,
    timer.displaySec,
    task,
    projects,
    activeProjectId,
    pauseAll,
    resetCurrent,
  ]);

  // Авто-завершение countdown
  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    const cur = timers[phase];
    if (cur.active !== "countdown") return;
    if (!cur.countdown.running) return;
    const rem = calcCountdownRemaining(cur.countdown, nowMs);
    if (rem > 0) return;

    handleFinishSession();
  }, [nowMs, phase, timers, handleFinishSession]);

  return (
    <div className="appRoot">
      <TopBar />

      <main className="screen">
        {tab === "focus" && (
          <FocusCard
            phase={phase}
            pt={pt}
            displaySec={displaySec}
            isRunning={isRunning}
            task={task}
            activeProjectName={activeProject?.name || TEXTS.defaultProjects.deepWork}
            todayStats={stats.todayStats}
            weekStats={stats.weekStats}
            musicSource={musicSource}
            onTaskChange={setTask}
            onTogglePhase={timer.togglePhase}
            onStartPause={timer.startPause}
            onReset={resetCurrent}
            onFinish={handleFinishSession}
            onApplyPreset={timer.applyPreset}
            onOpenProjects={() => setProjectsOpen(true)}
            onMusicSourceChange={setMusicSource}
          />
        )}

        {tab === "music" && (
          <div className="glass card">
            <div className="cardTitle">{TEXTS.music}</div>
            <div className="muted">{TEXTS.musicPlaceholder}</div>
          </div>
        )}

        {tab === "stats" && (
          <StatsCard
            statsPeriod={stats.statsPeriod}
            currentStats={stats.currentStats}
            chartData={stats.chartData}
            currentMonthName={stats.currentMonthName}
            customStatsFrom={stats.customStatsFrom}
            customStatsTo={stats.customStatsTo}
            onPeriodChange={stats.setStatsPeriod}
            onCustomFromChange={stats.setCustomStatsFrom}
            onCustomToChange={stats.setCustomStatsTo}
            onClearHistory={() => setHistory([])}
          />
        )}

        {tab === "profile" && (
          <div className="glass card">
            <div className="cardTitle">{TEXTS.profile}</div>
            <div className="muted">{TEXTS.profilePlaceholder}</div>
          </div>
        )}
      </main>

      <BottomNav currentTab={tab} onTabChange={setTab} />

      {projectsOpen && (
        <ProjectsModal
          isOpen={projectsOpen}
          projects={projects}
          activeProjectId={activeProjectId}
          onClose={() => setProjectsOpen(false)}
          onSelectProject={setActiveProjectId}
          onAddProject={(name) => {
            addProject(name);
          }}
          onRenameProject={renameProject}
          onDeleteProject={deleteProject}
        />
      )}
    </div>
  );
}
