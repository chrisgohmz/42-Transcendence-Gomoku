import "server-only";
import { defaultLocale, localeCookieName, locales, type Locale } from "@/i18n/config";

function isLocale(value: string | null | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    const rawValue = rawValueParts.join("=");

    if (rawName === name && rawValue) {
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function readAcceptedLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) {
    return null;
  }

  for (const item of acceptLanguage.split(",")) {
    const language = item.trim().split(";")[0]?.toLowerCase();
    const baseLanguage = language?.split("-")[0];

    if (isLocale(language)) {
      return language;
    }

    if (isLocale(baseLanguage)) {
      return baseLanguage;
    }
  }

  return null;
}

export function resolveApiLocale(request: Request): Locale {
  const explicitLocale = request.headers.get("x-locale");
  const cookieLocale = readCookieValue(request.headers.get("cookie"), localeCookieName);
  const acceptedLocale = readAcceptedLocale(request.headers.get("accept-language"));

  if (isLocale(explicitLocale)) {
    return explicitLocale;
  }

  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  return acceptedLocale ?? defaultLocale;
}
