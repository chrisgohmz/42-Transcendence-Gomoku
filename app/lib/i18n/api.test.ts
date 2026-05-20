import { describe, expect, mock, test } from "bun:test";

import { localeCookieName } from "@/i18n/config";

await mock.module("server-only", () => ({}));

const { resolveApiLocale } = await import("./api");

describe("resolveApiLocale", () => {
  test("prefers an explicit valid x-locale header over cookie and accept-language", () => {
    const request = requestWithHeaders({
      "accept-language": "ja-JP,zh;q=0.9,en;q=0.8",
      cookie: `${localeCookieName}=zh`,
      "x-locale": "ja",
    });

    expect(resolveApiLocale(request)).toBe("ja");
  });

  test("falls back to a decoded locale cookie when the explicit header is unsupported", () => {
    const request = requestWithHeaders({
      "accept-language": "ja-JP,zh;q=0.9,en;q=0.8",
      cookie: `theme=dark; ${localeCookieName}=${encodeURIComponent("zh")}`,
      "x-locale": "fr",
    });

    expect(resolveApiLocale(request)).toBe("zh");
  });

  test("uses the accepted base language when no explicit or cookie locale is valid", () => {
    const request = requestWithHeaders({
      "accept-language": "fr-CA;q=0.9, ja-JP;q=0.8, en-US;q=0.7",
      cookie: `${localeCookieName}=not-a-locale`,
    });

    expect(resolveApiLocale(request)).toBe("ja");
  });

  test("returns the default locale for malformed cookies and unsupported languages", () => {
    const request = requestWithHeaders({
      "accept-language": "fr-CA,es-MX;q=0.8",
      cookie: `${localeCookieName}=%E0%A4%A`,
    });

    expect(resolveApiLocale(request)).toBe("en");
  });
});

function requestWithHeaders(headers: HeadersInit) {
  return new Request("http://localhost/api/auth/login", { headers });
}
