// src/components/CustomTimeModal.tsx
import { useState, useEffect } from "react";
import { clampInt } from "../storage";
import { TEXTS } from "../constants";

interface CustomTimeModalProps {
  isOpen: boolean;
  currentMinutes: number;
  onSave: (minutes: number) => void;
  onClose: () => void;
}

export function CustomTimeModal({ isOpen, currentMinutes, onSave, onClose }: CustomTimeModalProps) {
  const [customMin, setCustomMin] = useState<number>(currentMinutes);

  useEffect(() => {
    if (isOpen) {
      setCustomMin(currentMinutes);
    }
  }, [isOpen, currentMinutes]);

  if (!isOpen) return null;

  const handleSave = () => {
    const m = clampInt(customMin, 1, 240);
    onSave(m);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="glass modal smallModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalTitle" style={{ marginBottom: 12 }}>
          {TEXTS.custom}
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
          <div className="customHint">{TEXTS.maxMinutes}</div>
        </div>

        <div className="customActions">
          <button className="btnGhost" onClick={onClose}>
            ←
          </button>
          <button className="btnGhost" onClick={handleSave}>
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}
