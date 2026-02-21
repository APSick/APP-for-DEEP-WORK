// src/constants.ts
// Константы для текстов приложения (локализация)

export const TEXTS = {
  // Общие
  appName: "focusOs",
  close: "Закрыть",
  save: "Сохранить",
  cancel: "Отмена",
  delete: "Удалить",
  edit: "Изменить",
  reset: "Сброс",
  finish: "Завершить",
  start: "СТАРТ",
  pause: "ПАУЗА",
  
  // Фокус
  focus: "Фокус",
  focusMode: "В режиме FOCUS",
  break: "Перерыв",
  taskPlaceholder: "над чем работаем?",
  elapsed: "прошло",
  remaining: "осталось",
  
  // Таймер
  stopwatch: "Секундомер",
  custom: "Своё",
  minutes: "мин",
  maxMinutes: "мин (макс 240)",
  
  // Музыка
  music: "Музыка",
  musicAll: "Вся музыка",
  musicFav: "Избранное",
  musicMy: "Мой плейлист",
  musicPlaceholder: "Подключим позже. Сейчас это вкладка-заготовка.",
  
  // Статистика
  stats: "Статистика",
  statsToday: "сегодня",
  statsWeek: "за неделю",
  statsTotal: "Всего",
  statsSessions: "сеанс",
  statsSessionsPlural: "сеансов",
  statsPeriodDay: "1 день",
  statsPeriodWeek: "1 неделя",
  statsPeriodMonth: "1 месяц",
  statsPeriodYear: "1 год",
  statsPeriodCustom: "Произвольный период",
  statsPeriodCustomLabel: "Произвольный",
  statsPeriodSelect: "Выбрать период",
  statsPeriodFrom: "От",
  statsPeriodTo: "До",
  statsClear: "Очистить",
  statsClearConfirm: "Очистить историю?",
  
  // Проекты
  projects: "Проекты",
  projectsSearchPlaceholder: "Поиск или добавление...",
  projectsAddPlaceholder: "Добавить проект…",
  projectsSelect: "Выбор проекта",
  projectsRenameTitle: "Новое название:",
  projectsDeleteConfirm: (name: string) => `Удалить "${name}"?`,
  
  // Профиль
  profile: "Профиль",
  profilePlaceholder: "Настройки/аккаунт добавим позже.",
  
  // Навигация
  navFocus: "Фокус",
  navMusic: "Музыка",
  navStats: "Статистика",
  navProfile: "Профиль",
  
  // Дефолтные проекты
  defaultProjects: {
    deepWork: "Deep Work",
    creative: "Креатив",
    study: "Учёба",
    reading: "Чтение",
    training: "Тренировка",
    other: "Другое",
  },
  
  // Дефолтный username (если не из Telegram)
  defaultUsername: "Гость",
} as const;
