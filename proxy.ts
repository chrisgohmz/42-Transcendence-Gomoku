import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "./app/i18n/routing";
import {
  createContentSecurityPolicy,
  CSP_HEADER,
  CSP_NONCE_HEADER,
  generateCspNonce,
} from "./app/lib/content-security-policy";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const nonce = generateCspNonce();
  const policy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, policy);

  const requestOverrideResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  const response = intlMiddleware(request);

  for (const [header, value] of requestOverrideResponse.headers) {
    if (header === "x-middleware-override-headers" || header.startsWith("x-middleware-request-")) {
      response.headers.set(header, value);
    }
  }

  response.headers.set(CSP_HEADER, policy);

  return response;
}

export const config = {
  matcher: [
    {
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
      source: "/((?!api|trpc|_next|_vercel|socket.io|icons|.*\\..*).*)",
    },
  ],
};
