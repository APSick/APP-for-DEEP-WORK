// src/components/BottomNav.tsx
import { TEXTS } from "../constants";

type Tab = "focus" | "music" | "stats" | "profile";

interface BottomNavProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottomNav">
      <button
        className={`navItem ${currentTab === "focus" ? "navActive" : ""}`}
        onClick={() => onTabChange("focus")}
      >
        <div className="navIcon">⌖</div>
        <div className="navLabel">{TEXTS.navFocus}</div>
      </button>
      <button
        className={`navItem ${currentTab === "music" ? "navActive" : ""}`}
        onClick={() => onTabChange("music")}
      >
        <div className="navIcon">♪</div>
        <div className="navLabel">{TEXTS.navMusic}</div>
      </button>
      <button
        className={`navItem ${currentTab === "stats" ? "navActive" : ""}`}
        onClick={() => onTabChange("stats")}
      >
        <div className="navIcon">▮▮▮</div>
        <div className="navLabel">{TEXTS.navStats}</div>
      </button>
      <button
        className={`navItem ${currentTab === "profile" ? "navActive" : ""}`}
        onClick={() => onTabChange("profile")}
      >
        <div className="navIcon">☺</div>
        <div className="navLabel">{TEXTS.navProfile}</div>
      </button>
    </nav>
  );
}
