// src/components/ProfileCard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { TEXTS } from "../constants";
import { getTg } from "../telegram";

interface ProfileCardProps {
  todayMinutes: number;
  dailyGoalMinutes: number;
  onDailyGoalChange: (minutes: number) => void;
}

export function ProfileCard({ todayMinutes, dailyGoalMinutes, onDailyGoalChange }: ProfileCardProps) {
  const tg = useMemo(() => getTg(), []);
  const user = tg?.initDataUnsafe?.user;

  const accountName =
    user?.username ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    TEXTS.profile;

  const accountSub = user ? `Telegram ID: ${user.id}` : TEXTS.profilePlaceholder;

  const goalCenter = dailyGoalMinutes;
  const goalStep = 5;
  const MIN_GOAL = 15;
  const MAX_GOAL = 300;
  const goalPrev = Math.max(MIN_GOAL, goalCenter - goalStep);
  const goalNext = Math.min(MAX_GOAL, goalCenter + goalStep);

  const [goalAnim, setGoalAnim] = useState<"" | "up" | "down">("");
  const wheelAccumRef = useRef(0);
  const animTimeoutRef = useRef<number | null>(null);
  const goalRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartGoalRef = useRef<number | null>(null);

  const progressText =
    todayMinutes > 0
      ? `Сегодня уже ${todayMinutes} мин фокуса`
      : "Сегодняшний прогресс появится после старта фокус-сессии.";

  const clampGoal = (m: number) => Math.max(MIN_GOAL, Math.min(MAX_GOAL, m));

  const stepGoal = (dir: "up" | "down") => {
    let next = goalCenter;
    next += dir === "up" ? -goalStep : goalStep;
    next = clampGoal(next);
    if (next === goalCenter) return;

    onDailyGoalChange(next);

    setGoalAnim(dir);
    if (animTimeoutRef.current != null) window.clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = window.setTimeout(() => {
      setGoalAnim("");
    }, 200);
  };

  const applyWheelDelta = (deltaY: number) => {
    if (!deltaY) return;

    const threshold = 80; // чем больше, тем «плавнее» и точнее
    wheelAccumRef.current += deltaY;

    let next = goalCenter;

    while (Math.abs(wheelAccumRef.current) >= threshold) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current -= threshold * dir;

      // Инверсия: скролл вниз (deltaY > 0) — больше цель, вверх — меньше
      next += dir > 0 ? goalStep : -goalStep;
    }

    next = clampGoal(next);
    if (next === goalCenter) return;

    // Направление шага: больше цель — вниз, меньше — вверх
    const direction: "up" | "down" = next > goalCenter ? "down" : "up";
    onDailyGoalChange(next);

    setGoalAnim(direction);
    if (animTimeoutRef.current != null) window.clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = window.setTimeout(() => {
      setGoalAnim("");
    }, 200);
  };

  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // При наведении на блок цели — крутим только цель, страницу не скроллим
      e.preventDefault();
      e.stopPropagation();
      applyWheelDelta(e.deltaY);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [goalCenter, onDailyGoalChange]);

  const startDrag = (clientY: number) => {
    dragStartYRef.current = clientY;
    dragStartGoalRef.current = goalCenter;
  };

  const updateDrag = (clientY: number) => {
    if (dragStartYRef.current == null || dragStartGoalRef.current == null) return;
    const dy = clientY - dragStartYRef.current;
    const pixelsPerStep = 12;
    if (Math.abs(dy) < pixelsPerStep) return;

    const steps = Math.round(dy / pixelsPerStep);
    let next = clampGoal(dragStartGoalRef.current + steps * goalStep);
    if (next === goalCenter) return;

    onDailyGoalChange(next);

    const direction: "up" | "down" = next > goalCenter ? "down" : "up";
    setGoalAnim(direction);
    if (animTimeoutRef.current != null) window.clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = window.setTimeout(() => {
      setGoalAnim("");
    }, 200);
  };

  const endDrag = () => {
    dragStartYRef.current = null;
    dragStartGoalRef.current = null;
  };

  const handleTouchStart = (e: any) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    startDrag(t.clientY);
  };

  const handleTouchMove = (e: any) => {
    if (!e.touches || e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0];
    updateDrag(t.clientY);
  };

  const handleTouchEnd = () => {
    endDrag();
  };

  const handleMouseDown = (e: any) => {
    startDrag(e.clientY);
    const onMove = (ev: MouseEvent) => {
      updateDrag(ev.clientY);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      endDrag();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="glass card profileCard">
      <div className="cardHeader">
        <div className="cardTitle">{TEXTS.profile}</div>
      </div>

      {/* 1 строка: аккаунт на всю ширину */}
      <div className="profileSectionLabel">аккаунт</div>
      <div className="profileAccountCard">
        <div className="profileAccountRow">
          <div className="profileAvatar" />
          <div className="profileAccountText">
            <div className="profileAccountName">{accountName}</div>
            <div className="profileAccountSub">{accountSub}</div>
          </div>
        </div>
      </div>

      {/* 2 строка: цель на день + рекомендация */}
      <div className="profileGrid">
        <div className="profileSectionLabel">цель на день</div>
        <div className="profileSectionLabel">рекомендация</div>

        <div
          ref={goalRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          className={
            "profileGoalCard" +
            (goalAnim === "up" ? " profileGoalCardStepUp" : "") +
            (goalAnim === "down" ? " profileGoalCardStepDown" : "")
          }
        >
          <div className="profileGoalValues">
            <div className="profileGoalValue profileGoalNeighbor">
              {goalPrev} мин
            </div>
            <div className="profileGoalValue profileGoalMain">
              {goalCenter} мин
            </div>
            <div className="profileGoalValue profileGoalNeighbor">
              {goalNext} мин
            </div>
          </div>
        </div>

        <div className="profileRecommendationCard">
          <p>
            Для заметного эффекта рекомендуем держать фокус{" "}
            <span className="profileTextStrong">не менее 90 минут</span> в день.
          </p>
          <p className="profileProgressText">{progressText}</p>
        </div>
      </div>

      {/* 3 строка: подписка */}
      <div className="profileSectionLabel profileSubscriptionLabel">подписка</div>
      <div className="profileSubscriptionCard">
        <div className="profileSubscriptionTitle">Открой полный доступ</div>
        <ul className="profileSubscriptionList">
          <li>музыка без ограничений</li>
          <li>таймер фокуса и статистика</li>
          <li>плейлисты и избранное</li>
        </ul>
        <button className="profileSubscriptionButton" type="button">
          Выбрать тариф
        </button>
      </div>
    </div>
  );
}

