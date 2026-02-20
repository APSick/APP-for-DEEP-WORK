// src/hooks/useProjects.ts
import { useEffect, useState } from "react";
import {
  loadActiveProjectId,
  loadProjects,
  saveActiveProjectId,
  saveProjects,
  uid,
  type Project,
} from "../storage";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState(() => {
    const id = loadActiveProjectId();
    const list = loadProjects();
    return id || list[0]?.id || "";
  });

  useEffect(() => saveProjects(projects), [projects]);
  useEffect(() => saveActiveProjectId(activeProjectId), [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  function addProject(name: string) {
    const p: Project = { id: uid(), name: name.trim() };
    setProjects((prev) => [p, ...prev]);
    setActiveProjectId(p.id);
    return p;
  }

  function renameProject(id: string, newName: string) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName.trim() } : p)));
  }

  function deleteProject(id: string) {
    setProjects((prev) => prev.filter((x) => x.id !== id));
    if (activeProjectId === id) {
      const next = projects.filter((x) => x.id !== id)[0];
      setActiveProjectId(next?.id ?? "");
    }
  }

  return {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    addProject,
    renameProject,
    deleteProject,
  };
}
