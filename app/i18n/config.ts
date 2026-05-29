export const locales = ["en", "ja", "zh"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "gomoku_locale";
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}
