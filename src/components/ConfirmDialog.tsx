// src/components/ConfirmDialog.tsx
import { TEXTS } from "../constants";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="glass modal smallModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalTitle" style={{ marginBottom: 12 }}>
          {title}
        </div>
        <div style={{ marginBottom: 16, color: "var(--muted)" }}>
          {message}
        </div>
        <div className="customActions">
          <button className="btnGhost" onClick={onCancel}>
            {TEXTS.cancel}
          </button>
          <button className="btnDanger" onClick={onConfirm}>
            {TEXTS.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
