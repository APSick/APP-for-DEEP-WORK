import { useEffect, useMemo, useRef, useState } from "react";
import { getTg } from "./telegram";
import { loadHistory, loadTask, saveHistory, saveTask, uid, type Session } from "./storage";
import "./App.css";

type Phase = "focus" | "break";
type Tab = "focus" | "music" | "stats" | "profile";

/** dropdown “Избранное” (музыка) */
type MusicSource = "all" | "fav" | "my";

/** dropdown “Deep Work” (проекты) */
type Project = { id: string; name: string };

type Snapshot = {
  // timer
  phase: Phase;
  running: boolean;
  seconds: number; // fixed: осталось, stopwatch: прошло
  mode: "fixed" | "stopwatch";
  focusMin: number;
  breakMin: number;
  sessionStartedAt: number | null;

  // ui
  tab: Tab;
  musicSource: MusicSource;
  projects: Project[];
  selectedProjectId: string | null;
  task: string;

  lastUpdatedAt: number;
};

const SNAP_KEY = "focusos.snapshot.v3";

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

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0..6
  const diff = day === 0 ? 6 : day - 1; // monday-first
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function plannedSecFor(phase: Phase, focusMin: number, breakMin: number) {
  return (phase === "focus" ? focusMin : breakMin) * 60;
}

function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

function saveSnapshot(s: Snapshot) {
  localStorage.setItem(SNAP_KEY, JSON.stringify(s));
}

function applySnapshot(s: Snapshot): Snapshot {
  const now = Date.now();
  const deltaSec = Math.max(0, Math.floor((now - (s.lastUpdatedAt || now)) / 1000));

  let seconds = s.seconds;
  let running = s.running;

  if (running) {
    if (s.mode === "fixed") {
      seconds = Math.max(0, seconds - deltaSec);
      if (seconds === 0) running = false;
    } else {
      seconds = seconds + deltaSec;
    }
  }

  let sessionStartedAt = s.sessionStartedAt ?? null;
  if (running && sessionStartedAt == null) {
    if (s.mode === "stopwatch") {
      sessionStartedAt = now - seconds * 1000;
    } else {
      const planned = plannedSecFor(s.phase, s.focusMin, s.breakMin);
      const elapsed = planned - seconds;
      sessionStartedAt = now - Math.max(0, elapsed) * 1000;
    }
  }

  return { ...s, seconds, running, sessionStartedAt, lastUpdatedAt: now };
}

function musicLabel(v: MusicSource) {
  if (v === "all") return "Вся музыка";
  if (v === "fav") return "Избранное";
  return "Мой плейлист";
}

export default function App() {
  const tg = useMemo(() => getTg(), []);

  const [tab, setTab] = useState<Tab>("focus");

  // dropdowns open state
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  // music source dropdown
  const [musicSource, setMusicSource] = useState<MusicSource>("fav");

  // projects dropdown
  const [projects, setProjects] = useState<Project[]>([
    { id: "p_deepwork", name: "Deep Work" },
    { id: "p_creative", name: "Креатив" },
    { id: "p_study", name: "Учёба" },
    { id: "p_read", name: "Чтение" },
    { id: "p_train", name: "Тренировка" },
    { id: "p_other", name: "Другое" },
  ]);
  const [projectQuery, setProjectQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>("p_deepwork");

  // timer state
  const [mode, setMode] = useState<"fixed" | "stopwatch">("stopwatch");
  const [focusMin, setFocusMin] = useState(DEFAULT_FOCUS_MIN);
  const [breakMin, setBreakMin] = useState(DEFAULT_BREAK_MIN);

  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  const [task, setTask] = useState("");
  const [history, setHistory] = useState<Session[]>([]);

  const musicMenuRef = useRef<HTMLDivElement | null>(null);
  const projectsRef = useRef<HTMLDivElement | null>(null);

  // Telegram init
  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, [tg]);

  // Load persisted
  useEffect(() => {
    setHistory(loadHistory());
    setTask(loadTask());

    const snap = loadSnapshot();
    if (snap) {
      const applied = applySnapshot(snap);

      setTab(applied.tab ?? "focus");

      setMusicSource(applied.musicSource ?? "fav");
      setProjects(applied.projects?.length ? applied.projects : projects);
      setSelectedProjectId(applied.selectedProjectId ?? "p_deepwork");

      setMode(applied.mode ?? "stopwatch");
      setFocusMin(applied.focusMin ?? DEFAULT_FOCUS_MIN);
      setBreakMin(applied.breakMin ?? DEFAULT_BREAK_MIN);

      setPhase(applied.phase ?? "focus");
      setRunning(!!applied.running);
      setSeconds(applied.seconds ?? 0);
      setSessionStartedAt(applied.sessionStartedAt ?? null);

      setTask(applied.task ?? "");
      saveSnapshot(applied);
    } else {
      const now = Date.now();
      const init: Snapshot = {
        tab: "focus",
        musicSource: "fav",
        projects,
        selectedProjectId: "p_deepwork",
        task: loadTask() || "",

        mode: "stopwatch",
        focusMin: DEFAULT_FOCUS_MIN,
        breakMin: DEFAULT_BREAK_MIN,
        phase: "focus",
        running: false,
        seconds: 0,
        sessionStartedAt: null,
        lastUpdatedAt: now,
      };
      saveSnapshot(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist task
  useEffect(() => {
    saveTask(task);
  }, [task]);

  // Close dropdowns on outside click / ESC
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (musicMenuOpen && musicMenuRef.current && !musicMenuRef.current.contains(t)) setMusicMenuOpen(false);
      if (projectsOpen && projectsRef.current && !projectsRef.current.contains(t)) setProjectsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMusicMenuOpen(false);
        setProjectsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [musicMenuOpen, projectsOpen]);

  // ticker
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSeconds((prev) => (mode === "fixed" ? (prev <= 1 ? 0 : prev - 1) : prev + 1));
    }, 1000);
    return () => clearInterval(t);
  }, [running, mode]);

  // auto-complete fixed
  useEffect(() => {
    if (mode !== "fixed") return;
    if (!running) return;
    if (seconds !== 0) return;

    const endedAt = Date.now();
    const startedAt = sessionStartedAt ?? endedAt;
    const planned = plannedSecFor(phase, focusMin, breakMin);

    const record: Session = {
      id: uid(),
      type: phase,
      task: phase === "focus" ? (task.trim() || "Без названия") : "Перерыв",
      startedAt,
      endedAt,
      durationSec: planned,
    };

    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 200);
      saveHistory(next);
      return next;
    });

    // next phase, auto continue
    const nextPhase: Phase = phase === "focus" ? "break" : "focus";
    const nextSeconds = plannedSecFor(nextPhase, focusMin, breakMin);
    const now = Date.now();

    setPhase(nextPhase);
    setSeconds(nextSeconds);
    setSessionStartedAt(now);

    tg?.HapticFeedback?.notificationOccurred?.("success");
  }, [seconds, running, mode, phase, focusMin, breakMin, sessionStartedAt, task, tg]);

  // Persist snapshot (all important UI + timer)
  useEffect(() => {
    const now = Date.now();
    const snap: Snapshot = {
      tab,
      musicSource,
      projects,
      selectedProjectId,
      task,

      mode,
      focusMin,
      breakMin,
      phase,
      running,
      seconds,
      sessionStartedAt,
      lastUpdatedAt: now,
    };
    saveSnapshot(snap);
  }, [tab, musicSource, projects, selectedProjectId, task, mode, focusMin, breakMin, phase, running, seconds, sessionStartedAt]);

  const displayTime = useMemo(() => fmtTime(seconds), [seconds]);

  const todayStart = startOfToday();
  const weekStart = startOfWeek();

  const todayFocusSec = history
    .filter((s) => s.type === "focus" && s.endedAt >= todayStart)
    .reduce((a, s) => a + s.durationSec, 0);

  const weekFocusSec = history
    .filter((s) => s.type === "focus" && s.endedAt >= weekStart)
    .reduce((a, s) => a + s.durationSec, 0);

  const todayMin = Math.round(todayFocusSec / 60);
  const weekMin = Math.round(weekFocusSec / 60);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  function pickMusic(next: MusicSource) {
    setMusicSource(next);
    setMusicMenuOpen(false);
    tg?.HapticFeedback?.impactOccurred?.("light");
  }

  function openProjects() {
    setProjectsOpen((v) => !v);
    setProjectQuery("");
    tg?.HapticFeedback?.impactOccurred?.("light");
  }

  function selectProject(id: string) {
    setSelectedProjectId(id);
    setProjectsOpen(false);
    tg?.HapticFeedback?.impactOccurred?.("light");
  }

  function addProject() {
    const name = projectQuery.trim();
    if (!name) return;
    const id = `p_${uid()}`;
    const next = [{ id, name }, ...projects];
    setProjects(next);
    setSelectedProjectId(id);
    setProjectQuery("");
    tg?.HapticFeedback?.notificationOccurred?.("success");
  }

  function renameProject(id: string) {
    const p = projects.find((x) => x.id === id);
    const raw = window.prompt("Новое название:", p?.name ?? "");
    const name = (raw ?? "").trim();
    if (!name) return;
    setProjects((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)));
  }

  function deleteProject(id: string) {
    const p = projects.find((x) => x.id === id);
    const ok = window.confirm(`Удалить "${p?.name ?? "проект"}"?`);
    if (!ok) return;
    setProjects((prev) => prev.filter((x) => x.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
  }

  function start() {
    const now = Date.now();
    setPhase("focus");
    if (mode === "fixed") setSeconds(plannedSecFor("focus", focusMin, breakMin));
    else setSeconds(0);
    setSessionStartedAt(now);
    setRunning(true);
    tg?.HapticFeedback?.impactOccurred?.("medium");
  }

  function togglePause() {
    setRunning((r) => !r);
    tg?.HapticFeedback?.impactOccurred?.("light");
  }

  function finish() {
    if (!sessionStartedAt) return;

    const endedAt = Date.now();
    const startedAt = sessionStartedAt;

    const planned = plannedSecFor(phase, focusMin, breakMin);
    const durationSec = mode === "fixed" ? Math.max(0, planned - seconds) : seconds;

    if (durationSec < 5) {
      setRunning(false);
      setSessionStartedAt(null);
      return;
    }

    const record: Session = {
      id: uid(),
      type: phase,
      task: phase === "focus" ? (task.trim() || selectedProject?.name || "Без названия") : "Перерыв",
      startedAt,
      endedAt,
      durationSec,
    };

    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 200);
      saveHistory(next);
      return next;
    });

    setRunning(false);
    setSessionStartedAt(null);
    setPhase("focus");
    setSeconds(mode === "fixed" ? focusMin * 60 : 0);

    tg?.HapticFeedback?.notificationOccurred?.("success");
  }

  function reset() {
    setRunning(false);
    setSessionStartedAt(null);
    setPhase("focus");
    setSeconds(mode === "fixed" ? focusMin * 60 : 0);
    tg?.HapticFeedback?.impactOccurred?.("light");
  }

  function clearHistory() {
    const next: Session[] = [];
    setHistory(next);
    saveHistory(next);
  }

  // ===== UI =====
  return (
    <div className="appRoot">
      <div className="topBar">
        <div className="topLeft">
          <div className="brand">focusOs</div>
        </div>
        <div className="topRight">
          <div className="userPill">Manager_arseniy2412</div>
          <div className="avatar" />
        </div>
      </div>

      <div className="screen">
        {tab === "focus" && (
          <div className="card glass">
            <div className="cardHeader">
              <div className="cardTitle">Фокус</div>
            </div>

            {/* Row 1: Избранное dropdown (music sources) + stats */}
            <div className="row between gap12">
              <div className="dropdownWrap" ref={musicMenuRef}>
                <button className="pillButton" onClick={() => setMusicMenuOpen((v) => !v)}>
                  <span className="pillText">{musicLabel(musicSource)}</span>
                  <span className="caret">▾</span>
                </button>

                {musicMenuOpen && (
                  <div className="menu glassMenu">
                    <button className="menuItem" onClick={() => pickMusic("all")}>
                      <span className="check">{musicSource === "all" ? "✓" : ""}</span>
                      <span>Вся музыка</span>
                    </button>
                    <button className="menuItem menuActive" onClick={() => pickMusic("fav")}>
                      <span className="check">{musicSource === "fav" ? "✓" : ""}</span>
                      <span>Избранное</span>
                    </button>
                    <button className="menuItem" onClick={() => pickMusic("my")}>
                      <span className="check">{musicSource === "my" ? "✓" : ""}</span>
                      <span>Мой плейлист</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="miniStat">
                <div className="miniStatLabel">сегодня</div>
                <div className="miniStatValue">{todayMin ? `${todayMin}м` : "—"}</div>
              </div>

              <div className="miniStat">
                <div className="miniStatLabel">за неделю</div>
                <div className="miniStatValue">{weekMin ? `${weekMin}м` : "—"}</div>
              </div>
            </div>

            {/* Task row + project dropdown (Deep Work) */}
            <div className="taskRow">
              <input
                className="taskInput"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="над чем работаем?"
              />

              <div className="dropdownWrap" ref={projectsRef}>
                <button className="taskTag taskTagClickable" onClick={openProjects}>
                  {selectedProject?.name ?? "Deep Work"} <span className="caret">▾</span>
                </button>

                {projectsOpen && (
                  <div className="projectsMenu glassMenu">
                    <div className="projectsSearch">
                      <input
                        className="projectsInput"
                        value={projectQuery}
                        onChange={(e) => setProjectQuery(e.target.value)}
                        placeholder="Поиск или добавление..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addProject();
                        }}
                      />
                      <button className="btnMini" onClick={addProject} disabled={!projectQuery.trim()}>
                        +
                      </button>
                    </div>

                    <div className="projectsList">
                      {projects
                        .filter((p) => p.name.toLowerCase().includes(projectQuery.trim().toLowerCase()))
                        .map((p) => (
                          <div
                            key={p.id}
                            className={`projectsItem ${p.id === selectedProjectId ? "projectsItemActive" : ""}`}
                          >
                            <button className="projectsPick" onClick={() => selectProject(p.id)}>
                              {p.name}
                            </button>
                            <div className="projectsActions">
                              <button className="btnOutline" onClick={() => renameProject(p.id)}>
                                Изменить
                              </button>
                              <button className="btnDangerOutline" onClick={() => deleteProject(p.id)}>
                                Удалить
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mode row */}
            <div className="row between gap12">
              <div className="modeInfo">
                <div className="modeInfoText">{phase === "focus" ? "В режиме FOCUS" : "Перерыв"}</div>
              </div>

              <div className="dropdownWrap">
                <button
                  className="pillButton"
                  onClick={() => {
                    // циклим по режимам просто для демо
                    if (mode === "stopwatch") {
                      setMode("fixed");
                      setSeconds(running ? seconds : focusMin * 60);
                    } else {
                      setMode("stopwatch");
                      setSeconds(running ? seconds : 0);
                    }
                    tg?.HapticFeedback?.impactOccurred?.("light");
                  }}
                >
                  <span className="pillText">{mode === "stopwatch" ? "Секундомер" : "Фикс-таймер"}</span>
                  <span className="caret">▾</span>
                </button>
              </div>
            </div>

            {/* Center ring */}
            <div className="centerArea">
              <div className={`ring ${running ? "ringActive" : ""}`}>
                <button
                  className="ringButton"
                  onClick={() => {
                    if (!running) start();
                    else togglePause();
                  }}
                >
                  {!running ? (
                    <>
                      <div className="ringLabel">СТАРТ</div>
                      <div className="ringSub">
                        {mode === "fixed" ? fmtTime(seconds || focusMin * 60) : "00:00"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="ringTime">{displayTime}</div>
                      <div className="ringSub">{mode === "fixed" ? "осталось" : "прошло"}</div>
                    </>
                  )}
                </button>
              </div>

              <div className="actionsRow">
                <button className="btnGhost" onClick={finish} disabled={!sessionStartedAt}>
                  Завершить
                </button>
                <button className="btnDanger" onClick={reset}>
                  Сброс
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "music" && (
          <div className="card glass">
            <div className="cardTitle">Музыка</div>
            <div className="muted">Позже подключим плейлисты (Spotify/Apple/локальные).</div>
          </div>
        )}

        {tab === "stats" && (
          <div className="card glass">
            <div className="row between">
              <div className="cardTitle">Статистика</div>
              <button className="btnDanger" onClick={clearHistory}>
                Очистить
              </button>
            </div>

            {history.length === 0 ? (
              <div className="muted">Пока нет сессий</div>
            ) : (
              <div className="list">
                {history.slice(0, 20).map((s) => (
                  <div key={s.id} className="listItem">
                    <div className="listTop">
                      <div className="listTitle">
                        {s.type === "focus" ? "Фокус" : "Перерыв"} • {Math.round(s.durationSec / 60)} мин
                      </div>
                      <div className="listTime">{new Date(s.endedAt).toLocaleString()}</div>
                    </div>
                    <div className="listTask">{s.task}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "profile" && (
          <div className="card glass">
            <div className="cardTitle">Профиль</div>
            <div className="muted">Настройки/аккаунт добавим позже.</div>
          </div>
        )}
      </div>

      <div className="bottomNav">
        <button className={`navItem ${tab === "focus" ? "navActive" : ""}`} onClick={() => setTab("focus")}>
          <div className="navIcon">⌖</div>
          <div className="navLabel">Фокус</div>
        </button>

        <button className={`navItem ${tab === "music" ? "navActive" : ""}`} onClick={() => setTab("music")}>
          <div className="navIcon">♫</div>
          <div className="navLabel">Музыка</div>
        </button>

        <button className={`navItem ${tab === "stats" ? "navActive" : ""}`} onClick={() => setTab("stats")}>
          <div className="navIcon">▮▮▮</div>
          <div className="navLabel">Статистика</div>
        </button>

        <button className={`navItem ${tab === "profile" ? "navActive" : ""}`} onClick={() => setTab("profile")}>
          <div className="navIcon">☺</div>
          <div className="navLabel">Профиль</div>
        </button>
      </div>
    </div>
  );
}
