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

function copyRequestOverrideHeaders(source: NextResponse, target: NextResponse) {
  // NextResponse.next({ request: { headers } }) forwards upstream request
  // overrides through these middleware transport headers. Keep the framework
  // contract isolated so nonce propagation is easy to audit if Next changes it.
  for (const [header, value] of source.headers) {
    const normalizedHeader = header.toLowerCase();

    if (
      normalizedHeader === "x-middleware-override-headers" ||
      normalizedHeader.startsWith("x-middleware-request-")
    ) {
      target.headers.set(header, value);
    }
  }
}

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

  copyRequestOverrideHeaders(requestOverrideResponse, response);
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
