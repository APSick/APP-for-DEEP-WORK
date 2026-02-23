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
  /** Облачное хранилище — синхронизируется между устройствами одного пользователя (Bot API 6.9+) */
  CloudStorage?: TelegramCloudStorage;
  [key: string]: unknown; // для других возможных свойств
}

export interface TelegramCloudStorage {
  setItem(key: string, value: string, callback?: (err: string | null, success?: boolean) => void): TelegramCloudStorage;
  getItem(key: string, callback: (err: string | null, value?: string) => void): TelegramCloudStorage;
  getItems(keys: string[], callback: (err: string | null, values?: Record<string, string>) => void): TelegramCloudStorage;
  removeItem(key: string, callback?: (err: string | null, removed?: boolean) => void): TelegramCloudStorage;
  removeItems(keys: string[], callback?: (err: string | null, removed?: boolean) => void): TelegramCloudStorage;
  getKeys(callback: (err: string | null, keys?: string[]) => void): TelegramCloudStorage;
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

const CLOUD_KEY_TIMER = "dw_time_mode_v2";

/**
 * Читает значение из облачного хранилища Telegram (синхронизация между устройствами).
 * Возвращает null, если не в TMA или Cloud Storage недоступен.
 */
export function getCloudItem(key: string): Promise<string | null> {
  const cloud = getTg()?.CloudStorage;
  if (!cloud) return Promise.resolve(null);
  return new Promise((resolve) => {
    cloud.getItem(key, (err, value) => {
      if (err != null) {
        resolve(null);
        return;
      }
      resolve(value ?? null);
    });
  });
}

/**
 * Записывает значение в облачное хранилище Telegram.
 * Возвращает false, если не в TMA или Cloud Storage недоступен.
 */
export function setCloudItem(key: string, value: string): Promise<boolean> {
  const cloud = getTg()?.CloudStorage;
  if (!cloud) return Promise.resolve(false);
  return new Promise((resolve) => {
    cloud.setItem(key, value, (err, success) => {
      resolve(err == null && success === true);
    });
  });
}

/** Ключ таймера в облаке (общий для синхронизации между устройствами) */
export function getCloudTimerKey(): string {
  return CLOUD_KEY_TIMER;
}

