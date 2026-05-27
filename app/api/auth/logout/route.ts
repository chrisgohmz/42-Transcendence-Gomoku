import { auth } from "../../../lib/auth";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { rateLimitRule } from "../../../lib/rate-limit-rules";
import { enforceMutationRequest } from "../../../lib/request-security";

const authCookieNames = [
  "better-auth.session_token",
  "better-auth.session_data",
  "better-auth.account_data",
  "better-auth.dont_remember",
];

function getRequestCookieNames(request: Request): string[] {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name));
}

function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return new URL(request.url).protocol === "https:";
}

function appendExpiredCookie(headers: Headers, name: string, secure: boolean) {
  const secureAttribute = secure ? "; Secure" : "";

  headers.append(
    "set-cookie",
    `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secureAttribute}`,
  );
}

function appendFallbackAuthCookieExpirations(headers: Headers, request: Request) {
  const secure = isSecureRequest(request);
  const cookieNames = new Set([
    ...authCookieNames,
    ...authCookieNames.map((name) => `__Secure-${name}`),
    ...getRequestCookieNames(request).filter((name) =>
      authCookieNames.some(
        (authCookieName) =>
          name === authCookieName ||
          name === `__Secure-${authCookieName}` ||
          name.startsWith(`${authCookieName}.`) ||
          name.startsWith(`__Secure-${authCookieName}.`),
      ),
    ),
  ]);

  for (const name of cookieNames) {
    appendExpiredCookie(headers, name, secure);
  }
}

export async function POST(request: Request) {
  const requestGuardResponse = enforceMutationRequest(request);

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const rateLimitExceededResponse = await enforceRateLimit(
    request.headers,
    rateLimitRule("authLogout"),
  );

  if (rateLimitExceededResponse) {
    return rateLimitExceededResponse;
  }

  const authResponse = await auth.api
    .signOut({
      headers: request.headers,
      request,
      returnHeaders: true,
    })
    .catch(() => null);
  const responseHeaders = new Headers(authResponse?.headers);

  if (!responseHeaders.has("set-cookie")) {
    appendFallbackAuthCookieExpirations(responseHeaders, request);
  }

  return Response.json({ success: true }, { headers: responseHeaders });
}
