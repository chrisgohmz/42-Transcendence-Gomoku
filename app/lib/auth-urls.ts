import "server-only";
import type { Locale } from "../i18n/config";
import {
  getConfiguredAuthBaseUrl,
  getRequestOrigin,
  getTrustedAuthOrigins,
  isTrustedAuthOrigin,
} from "./auth-origins";

type AuthUrlContext = {
  headers?: Headers;
  requestUrl?: string;
};

export function getAuthAppBaseUrl({ headers, requestUrl }: AuthUrlContext = {}): string {
  const requestOrigin = getRequestOrigin(headers, requestUrl);

  if (requestOrigin && isTrustedAuthOrigin(requestOrigin)) {
    return requestOrigin;
  }

  const configuredBaseUrl = getConfiguredAuthBaseUrl();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const [firstTrustedOrigin] = getTrustedAuthOrigins();

  if (firstTrustedOrigin) {
    return firstTrustedOrigin;
  }

  if (requestOrigin) {
    return requestOrigin;
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
