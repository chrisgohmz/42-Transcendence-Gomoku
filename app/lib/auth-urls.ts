import "server-only";
import type { Locale } from "../i18n/config";

type AuthUrlContext = {
  headers?: Headers;
  requestUrl?: string;
};

function getFirstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function getAuthAppBaseUrl({ headers, requestUrl }: AuthUrlContext = {}): string {
  const configuredBaseUrl = process.env["BETTER_AUTH_URL"]?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const origin = headers?.get("origin")?.trim();

  if (origin) {
    return origin;
  }

  const forwardedHost = getFirstHeaderValue(headers?.get("x-forwarded-host") ?? null);
  const host = forwardedHost ?? headers?.get("host")?.trim();

  if (host) {
    const forwardedProto = getFirstHeaderValue(headers?.get("x-forwarded-proto") ?? null) ?? "http";
    return `${forwardedProto}://${host}`;
  }

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      return "http://localhost:3000";
    }
  }

  return "http://localhost:3000";
}

export function getLocalizedAuthAppUrl(
  locale: Locale,
  path: string,
  context: AuthUrlContext = {},
): string {
  return new URL(`/${locale}${path}`, getAuthAppBaseUrl(context)).toString();
}
