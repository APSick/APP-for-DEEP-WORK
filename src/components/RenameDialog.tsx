// src/components/RenameDialog.tsx
import { useState, useEffect } from "react";
import { TEXTS } from "../constants";

interface RenameDialogProps {
  isOpen: boolean;
  currentName: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ isOpen, currentName, onSave, onCancel }: RenameDialogProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onSave(trimmed);
    }
  };

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="glass modal smallModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalTitle" style={{ marginBottom: 12 }}>
          {TEXTS.projectsRenameTitle}
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            className="projectsInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onCancel();
            }}
            autoFocus
          />
        </div>
        <div className="customActions">
          <button className="btnGhost" onClick={onCancel}>
            {TEXTS.cancel}
          </button>
          <button className="btnGhost" onClick={handleSave} disabled={!name.trim()}>
            {TEXTS.save}
          </button>
        </div>
      </div>
    </div>
  );
}
