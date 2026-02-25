// src/components/ProfileCard.tsx
import { useMemo, useRef, useState } from "react";
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
  const goalPrev = Math.max(30, goalCenter - goalStep);
  const goalNext = Math.min(600, goalCenter + goalStep);

  const [goalAnim, setGoalAnim] = useState<"" | "up" | "down">("");
  const wheelAccumRef = useRef(0);
  const animTimeoutRef = useRef<number | null>(null);

  const progressText =
    todayMinutes > 0
      ? `Сегодня уже ${todayMinutes} мин фокуса`
      : "Сегодняшний прогресс появится после старта фокус-сессии.";

  const clampGoal = (m: number) => Math.max(30, Math.min(600, m));

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    // При наведении на блок цели — крутим только цель, страницу не скроллим
    e.preventDefault();
    e.stopPropagation();
    if (!e.deltaY) return;

    const threshold = 80; // чем больше, тем «плавнее» и точнее
    wheelAccumRef.current += e.deltaY;

    let next = goalCenter;

    while (Math.abs(wheelAccumRef.current) >= threshold) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current -= threshold * dir;

      // Инверсия: скролл вниз (deltaY > 0) — больше цель, вверх — меньше
      next += dir > 0 ? goalStep : -goalStep;
    }

    next = clampGoal(next);
    if (next === goalCenter) return;

    onDailyGoalChange(next);

    // Анимация «барабана» — вверх/вниз в зависимости от направления шага
    const direction = next > goalCenter ? "down" : "up";
    setGoalAnim(direction);
    if (animTimeoutRef.current != null) window.clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = window.setTimeout(() => {
      setGoalAnim("");
    }, 200);
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
        <div className="profileCol">
          <div className="profileSectionLabel">цель на день</div>
          <div
            className={
              "profileGoalCard" +
              (goalAnim === "up" ? " profileGoalCardStepUp" : "") +
              (goalAnim === "down" ? " profileGoalCardStepDown" : "")
            }
            onWheelCapture={handleWheel}
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
        </div>

        <div className="profileCol profileColRight">
          <div className="profileSectionLabel">рекомендация</div>
          <div className="profileRecommendationCard">
            <p>
              Для заметного эффекта рекомендуем держать фокус{" "}
              <span className="profileTextStrong">не менее 90 минут</span> в день.
            </p>
            <p className="profileProgressText">{progressText}</p>
          </div>
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

