export const locales = ["en", "ja", "zh"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "gomoku_locale";
export const localeCookieMaxAge = 60 * 60 * 24 * 365;
