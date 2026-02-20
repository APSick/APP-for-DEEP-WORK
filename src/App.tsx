// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getTg } from "./telegram";
import {
  clampInt,
  loadActiveProjectId,
  loadHistory,
  loadProjects,
  loadTask,
  loadTimeMode,
  saveActiveProjectId,
  saveHistory,
  saveProjects,
  saveTask,
  saveTimeMode,
  uid,
  type Phase,
  type PhaseTimer,
  type Project,
  type Session,
  type TimeModeSnapshotV2,
  type TimerKind,
} from "./storage";

type Tab = "focus" | "music" | "stats" | "profile";
type MusicSource = "all" | "fav" | "my";

function fmtMMSS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function calcStopwatchSec(track: PhaseTimer["stopwatch"], nowMs: number) {
  if (!track.running || !track.startedAt) return track.baseSec;
  return track.baseSec + Math.floor((nowMs - track.startedAt) / 1000);
}

function calcCountdownRemaining(track: PhaseTimer["countdown"], nowMs: number) {
  let rem = track.baseRemainingSec;
  if (track.running && track.startedAt) {
    rem = rem - Math.floor((nowMs - track.startedAt) / 1000);
  }
  return Math.max(0, rem);
}

function defaultPhaseTimer(min: number, active: TimerKind = "stopwatch"): PhaseTimer {
  return {
    active,
    countdownMin: min,
    stopwatch: { running: false, baseSec: 0, startedAt: null },
    countdown: { running: false, baseRemainingSec: min * 60, startedAt: null, durationMin: min },
  };
}

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

  // ===== data =====
  const [tab, setTab] = useState<Tab>("focus");

  const [musicSource, setMusicSource] = useState<MusicSource>("fav");
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);

  const [task, setTask] = useState(() => loadTask());
  useEffect(() => saveTask(task), [task]);

  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  useEffect(() => saveProjects(projects), [projects]);

  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [newProjectName, setNewProjectName] = useState("");

  const [activeProjectId, setActiveProjectId] = useState(() => {
    const id = loadActiveProjectId();
    const list = loadProjects();
    return id || list[0]?.id || "";
  });
  useEffect(() => saveActiveProjectId(activeProjectId), [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const [history, setHistory] = useState<Session[]>(() => loadHistory());
  useEffect(() => saveHistory(history), [history]);

  // ===== timer state (v2) =====
  const [phase, setPhase] = useState<Phase>("focus");
  const [timers, setTimers] = useState<{ focus: PhaseTimer; break: PhaseTimer }>(() => {
    const snap = loadTimeMode();
    if (snap?.v === 2) return { focus: snap.focus, break: snap.break };
    // дефолты
    return { focus: defaultPhaseTimer(45, "stopwatch"), break: defaultPhaseTimer(15, "countdown") };
  });

  // на старте применим snapshot полностью (включая phase), если он есть
  useEffect(() => {
    const snap = loadTimeMode();
    if (snap?.v === 2) {
      setPhase(snap.phase);
      setTimers({ focus: snap.focus, break: snap.break });
    }
  }, []);

  // сохраняем в localStorage
  useEffect(() => {
    const snap: TimeModeSnapshotV2 = { v: 2, phase, focus: timers.focus, break: timers.break };
    saveTimeMode(snap);
  }, [phase, timers]);

  // ===== “тик” времени =====
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

  // ===== timer menu =====
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState<number>(pt.countdownMin);

  // авто-завершение countdown
  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    const cur = timers[phase];
    if (cur.active !== "countdown") return;
    if (!cur.countdown.running) return;
    const rem = calcCountdownRemaining(cur.countdown, nowMs);
    if (rem > 0) return;

    // стоп + лог
    finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs]);

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

      // если на нуле — перезапускаем с полной длительности
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

  function finishSession() {
    const t = Date.now();

    // остановим всё и посчитаем длительность “сейчас”
    const cur = timers[phase];
    const durSec =
      cur.active === "stopwatch"
        ? calcStopwatchSec(cur.stopwatch, t)
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
    // после “завершить” логично сбросить текущий таймер
    setTimeout(() => resetCurrent(), 0);
  }

  function applyPreset(kind: TimerKind, minutes?: number) {
    // при переключении — обязательно пауза, чтобы НЕ было “обратного времени”
    pauseAll();

    if (kind === "stopwatch") {
      setTimers((prev) => {
        const cur = prev[phase];
        return { ...prev, [phase]: { ...cur, active: "stopwatch" } };
      });
      return;
    }

    const m = clampInt(minutes ?? pt.countdownMin, 1, 240);

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

  // ===== stats =====
  const todayMin = Math.round(
    history
      .filter((s) => {
        const d = new Date(s.endedAt);
        const now = new Date();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate() &&
          s.type === "focus"
        );
      })
      .reduce((acc, s) => acc + s.durationSec, 0) / 60
  );

  const weekMin = Math.round(
    history
      .filter((s) => {
        const now = Date.now();
        const sevenDays = 7 * 24 * 3600 * 1000;
        return s.endedAt >= now - sevenDays && s.type === "focus";
      })
      .reduce((acc, s) => acc + s.durationSec, 0) / 60
  );

  // ===== UI helpers =====
  const timerLabel =
    pt.active === "stopwatch" ? "Секундомер" : `${pt.countdownMin} мин`;

  function addProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const p: Project = { id: uid(), name };
    setProjects((prev) => [p, ...prev]);
    setActiveProjectId(p.id);
    setNewProjectName("");
    setProjectSearch("");
  }

  function renameProject(id: string) {
    const current = projects.find((p) => p.id === id);
    const name = prompt("Новое название:", current?.name ?? "");
    if (!name) return;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
  }

  function deleteProject(id: string) {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Удалить "${p.name}"?`)) return;

    setProjects((prev) => prev.filter((x) => x.id !== id));
    if (activeProjectId === id) {
      const next = projects.filter((x) => x.id !== id)[0];
      setActiveProjectId(next?.id ?? "");
    }
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
  );

  return (
    <div className="appRoot">
      <div className="topBar">
        <div className="brand">focusOs</div>
        <div className="topRight">
          <div className="userPill">
            {tg?.initDataUnsafe?.user?.username
              ? tg.initDataUnsafe.user.username
              : "Manager_arseniy2412"}
          </div>
          <div className="avatar" />
        </div>
      </div>

      <main className="screen">
        {tab === "focus" && (
          <div className="glass card focusCard">
            <div className="cardHeader">
              <div className="cardTitle">Фокус</div>

              <div className="row gap12">
                <div className="dropdownWrap">
                  <button
                    className="pillButton"
                    onClick={() => setMusicMenuOpen((v) => !v)}
                  >
                    <span className="pillText">
                      {musicSource === "fav"
                        ? "Избранное"
                        : musicSource === "all"
                        ? "Вся музыка"
                        : "Мой плейлист"}
                    </span>
                    <span className="caret">▼</span>
                  </button>

                  {musicMenuOpen && (
                    <div className="glassMenu">
                      <div className="menu">
                        <button
                          className={`menuItem ${musicSource === "all" ? "menuActive" : ""}`}
                          onClick={() => {
                            setMusicSource("all");
                            setMusicMenuOpen(false);
                          }}
                        >
                          <span className="check">{musicSource === "all" ? "✓" : ""}</span>
                          Вся музыка
                        </button>
                        <button
                          className={`menuItem ${musicSource === "fav" ? "menuActive" : ""}`}
                          onClick={() => {
                            setMusicSource("fav");
                            setMusicMenuOpen(false);
                          }}
                        >
                          <span className="check">{musicSource === "fav" ? "✓" : ""}</span>
                          Избранное
                        </button>
                        <button
                          className={`menuItem ${musicSource === "my" ? "menuActive" : ""}`}
                          onClick={() => {
                            setMusicSource("my");
                            setMusicMenuOpen(false);
                          }}
                        >
                          <span className="check">{musicSource === "my" ? "✓" : ""}</span>
                          Мой плейлист
                        </button>
                      </div>
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
            </div>

            <div className="taskRow">
              <input
                className="taskInput"
                placeholder="над чем работаем?"
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />

              <button
                className="taskTag taskTagClickable"
                onClick={() => setProjectsOpen(true)}
                title="Выбор проекта"
              >
                {activeProject?.name ?? "Deep Work"} ▼
              </button>
            </div>

            <div className="row gap12">
              <button className="modeInfo modeInfoBtn" onClick={togglePhase}>
                <span className="modeInfoText">
                  {phase === "focus" ? "В режиме FOCUS" : "Перерыв"}
                </span>
              </button>

              <div className="dropdownWrap" style={{ marginLeft: "auto" }}>
                <button className="pillButton" onClick={() => setTimerMenuOpen((v) => !v)}>
                  <span className="pillText">{timerLabel}</span>
                  <span className="caret">▼</span>
                </button>

                {timerMenuOpen && (
                  <div
                    className="sheetBackdrop"
                    onClick={() => setTimerMenuOpen(false)}
                  >
                    <div
                      className="timeMenuSheet"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="timeMenuTitle">Секундомер</div>

                      <div className="timeMenuList">
                        <button
                          className={`menuItem ${pt.active === "stopwatch" ? "menuActive" : ""}`}
                          onClick={() => { applyPreset("stopwatch"); setTimerMenuOpen(false); }}
                        >
                          <span className="check">{pt.active === "stopwatch" ? "✓" : ""}</span>
                          Секундомер
                        </button>

                        {[15, 25, 45, 60, 90].map((m) => (
                          <button
                            key={m}
                            className={`menuItem ${pt.active === "fixed" && pt.minutes === m ? "menuActive" : ""}`}
                            onClick={() => { applyPreset("fixed", m); setTimerMenuOpen(false); }}
                          >
                            <span className="check">{pt.active === "fixed" && pt.minutes === m ? "✓" : ""}</span>
                            {m} мин
                          </button>
                        ))}

                        <button
                          className={`menuItem ${pt.active === "custom" ? "menuActive" : ""}`}
                          onClick={() => { setCustomOpen(true); setTimerMenuOpen(false); }}
                        >
                          <span className="check">{pt.active === "custom" ? "✓" : ""}</span>
                          Своё
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="centerArea">
              <div className={`ring ${isRunning ? "ringActive" : ""}`}>
                <button className="ringButton" onClick={startPause}>
                  <div className="ringLabel">{isRunning ? "ПАУЗА" : "СТАРТ"}</div>
                  <div className="ringTime">{fmtMMSS(displaySec)}</div>
                  <div className="ringSub">
                    {pt.active === "stopwatch" ? "прошло" : "осталось"}
                  </div>
                </button>
              </div>

              <div className="actionsRow">
                <button className="btnGhost" onClick={finishSession} disabled={!isRunning && displaySec === 0}>
                  Завершить
                </button>
                <button className="btnDanger" onClick={resetCurrent}>
                  Сброс
                </button>
              </div>
            </div>

            

            
          </div>
        )}

        {tab === "music" && (
          <div className="glass card">
            <div className="cardTitle">Музыка</div>
            <div className="muted">Подключим позже. Сейчас это вкладка-заготовка.</div>
          </div>
        )}

        {tab === "stats" && (
          <div className="glass card">
            <div className="row between">
              <div className="cardTitle">Статистика</div>
              <button
                className="btnDangerOutline"
                onClick={() => {
                  if (confirm("Очистить историю?")) setHistory([]);
                }}
              >
                Очистить
              </button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              Сегодня: {todayMin ? `${todayMin} мин` : "—"} • За неделю:{" "}
              {weekMin ? `${weekMin} мин` : "—"}
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div className="glass card">
            <div className="cardTitle">Профиль</div>
            <div className="muted">Настройки/аккаунт добавим позже.</div>
          </div>
        )}
      </main>

      <nav className="bottomNav">
        <button className={`navItem ${tab === "focus" ? "navActive" : ""}`} onClick={() => setTab("focus")}>
          <div className="navIcon">⌖</div>
          <div className="navLabel">Фокус</div>
        </button>
        <button className={`navItem ${tab === "music" ? "navActive" : ""}`} onClick={() => setTab("music")}>
          <div className="navIcon">♪</div>
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
      </nav>

      {/* ===== Projects modal (чтобы ВСЕГДА было в видимой области) ===== */}
      {projectsOpen && (
        <div className="overlay" onClick={() => setProjectsOpen(false)}>
          <div className="glass modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Проекты</div>
              <button className="btnOutline" onClick={() => setProjectsOpen(false)}>
                Закрыть
              </button>
            </div>

            <div className="projectsSearchBlock">
              <input
                className="projectsInput"
                placeholder="Поиск или добавление..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
            </div>

            <div className="projectsSearchBlock" style={{ marginTop: 10 }}>
              <input
                className="projectsInput"
                placeholder="Добавить проект…"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              <button className="btnMini" onClick={addProject} disabled={!newProjectName.trim()}>
                +
              </button>
            </div>

            <div className="projectsList modalList">
              {filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className={`projectsItem ${p.id === activeProjectId ? "projectsItemActive" : ""}`}
                >
                  <button
                    className="projectsPick"
                    onClick={() => {
                      setActiveProjectId(p.id);
                      setProjectsOpen(false);
                    }}
                  >
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
        </div>
      )}

      {/* ===== Custom minutes modal (как на твоём скрине) ===== */}
      {customOpen && (
        <div className="overlay" onClick={() => setCustomOpen(false)}>
          <div className="glass modal smallModal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle" style={{ marginBottom: 12 }}>
              Своё
            </div>

            <div className="customRow">
              <input
                className="customInput"
                type="number"
                min={1}
                max={240}
                value={customMin}
                onChange={(e) => {
                  const n = clampInt(parseInt(e.target.value || "0", 10), 1, 240);
                  setCustomMin(n);
                }}
              />
              <div className="customHint">мин (макс 240)</div>
            </div>

            <div className="customActions">
              <button className="btnGhost" onClick={() => setCustomOpen(false)}>
                ←
              </button>
              <button
                className="btnGhost"
                onClick={() => {
                  const m = clampInt(customMin, 1, 240);
                  applyPreset("countdown", m);
                  setCustomOpen(false);
                }}
              >
                ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
