// src/components/ConfirmDialog.tsx
import { useEffect } from "react";
import { TEXTS } from "../constants";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = TEXTS.delete,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onCancel]);

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
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
