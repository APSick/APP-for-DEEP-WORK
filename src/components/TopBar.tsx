// src/components/TopBar.tsx
import { getTg } from "../telegram";
import { TEXTS } from "../constants";

export function TopBar() {
  const tg = getTg();
  const username = tg?.initDataUnsafe?.user?.username || TEXTS.defaultUsername;

  return (
    <div className="topBar">
      <div className="brand">{TEXTS.appName}</div>
      <div className="topRight">
        <div className="userPill">{username}</div>
        <div className="avatar" />
      </div>
    </div>
  );
}
