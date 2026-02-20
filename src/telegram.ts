/**
 * Типы для Telegram WebApp API
 * Документация: https://core.telegram.org/bots/webapps
 */
export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppInitData {
  user?: TelegramWebAppUser;
  auth_date?: number;
  hash?: string;
}

export interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  initDataUnsafe?: TelegramWebAppInitData;
  version?: string;
  platform?: string;
  colorScheme?: "light" | "dark";
  themeParams?: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  isExpanded?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  MainButton?: unknown;
  BackButton?: unknown;
  SettingsButton?: unknown;
  HapticFeedback?: unknown;
  CloudStorage?: unknown;
  [key: string]: unknown; // для других возможных свойств
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * Получает экземпляр Telegram WebApp API
 * Возвращает null, если приложение запущено не в Telegram
 */
export function getTg(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

