// src/components/ProjectsModal.tsx
import { useState } from "react";
import { TEXTS } from "../constants";
import { RenameDialog } from "./RenameDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Project } from "../storage";

interface ProjectsModalProps {
  isOpen: boolean;
  projects: Project[];
  activeProjectId: string;
  onClose: () => void;
  onSelectProject: (id: string) => void;
  onAddProject: (name: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
}

export function ProjectsModal({
  isOpen,
  projects,
  activeProjectId,
  onClose,
  onSelectProject,
  onAddProject,
  onRenameProject,
  onDeleteProject,
}: ProjectsModalProps) {
  const [projectSearch, setProjectSearch] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
  );

  const handleAdd = () => {
    const name = newProjectName.trim();
    if (name) {
      onAddProject(name);
      setNewProjectName("");
      setProjectSearch("");
    }
  };

  const handleRename = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setRenameId(id);
    }
  };

  const handleSaveRename = (newName: string) => {
    if (renameId) {
      onRenameProject(renameId, newName);
      setRenameId(null);
    }
  };

  const handleDelete = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setDeleteId(id);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDeleteProject(deleteId);
      setDeleteId(null);
    }
  };

  const projectToRename = renameId ? projects.find((p) => p.id === renameId) : null;
  const projectToDelete = deleteId ? projects.find((p) => p.id === deleteId) : null;

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <div className="glass modal" onClick={(e) => e.stopPropagation()}>
          <div className="modalHeader">
            <div className="modalTitle">{TEXTS.projects}</div>
            <button className="btnOutline" onClick={onClose}>
              {TEXTS.close}
            </button>
          </div>

          <div className="projectsSearchBlock">
            <input
              className="projectsInput"
              placeholder={TEXTS.projectsSearchPlaceholder}
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
            />
          </div>

          <div className="projectsSearchBlock" style={{ marginTop: 10 }}>
            <input
              className="projectsInput"
              placeholder={TEXTS.projectsAddPlaceholder}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <button className="btnMini" onClick={handleAdd} disabled={!newProjectName.trim()}>
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
                    onSelectProject(p.id);
                    onClose();
                  }}
                >
                  {p.name}
                </button>
                <div className="projectsActions">
                  <button className="btnOutline" onClick={() => handleRename(p.id)}>
                    {TEXTS.edit}
                  </button>
                  <button className="btnDangerOutline" onClick={() => handleDelete(p.id)}>
                    {TEXTS.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {projectToRename && (
        <RenameDialog
          isOpen={renameId !== null}
          currentName={projectToRename.name}
          onSave={handleSaveRename}
          onCancel={() => setRenameId(null)}
        />
      )}

      {projectToDelete && (
        <ConfirmDialog
          isOpen={deleteId !== null}
          title={TEXTS.delete}
          message={TEXTS.projectsDeleteConfirm(projectToDelete.name)}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  );
}
