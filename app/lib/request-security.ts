import "server-only";
import { getConfiguredAuthBaseUrl, getTrustedAuthOrigins } from "./auth-origins";

type RequestSecurityOptions = {
  requireJson?: boolean;
};

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = new Set(getTrustedAuthOrigins(env));
  const configuredBaseUrl = getConfiguredAuthBaseUrl(env);

  if (configuredBaseUrl) {
    origins.add(configuredBaseUrl);
  }

  return Array.from(origins);
}

function forbiddenResponse(error: string, message: string) {
  return Response.json({ error, message }, { status: 403 });
}

function unsupportedMediaTypeResponse() {
  return Response.json(
    {
      error: "unsupported_media_type",
      message: "This endpoint expects a JSON request body.",
    },
    { status: 415 },
  );
}

export function enforceSameOriginRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Response | null {
  const originHeader = request.headers.get("origin");

  if (!originHeader) {
    if (env["NODE_ENV"] === "production") {
      return forbiddenResponse("origin_required", "Origin header is required.");
    }

    return null;
  }

  const requestOrigin = normalizeOrigin(originHeader);

  if (!requestOrigin) {
    return forbiddenResponse("invalid_origin", "Origin header is invalid.");
  }

  const allowedOrigins = getAllowedOrigins(env);

  if (allowedOrigins.length === 0) {
    if (env["NODE_ENV"] === "production") {
      return forbiddenResponse("origin_not_configured", "Trusted origins are not configured.");
    }

    return requestOrigin === normalizeOrigin(request.url)
      ? null
      : forbiddenResponse("untrusted_origin", "Origin is not allowed.");
  }

  return allowedOrigins.includes(requestOrigin)
    ? null
    : forbiddenResponse("untrusted_origin", "Origin is not allowed.");
}

export function enforceJsonRequest(request: Request): Response | null {
  const contentType = request.headers.get("content-type");

  return contentType?.toLowerCase().includes("application/json")
    ? null
    : unsupportedMediaTypeResponse();
}

export function enforceMutationRequest(
  request: Request,
  options: RequestSecurityOptions = {},
): Response | null {
  const originResponse = enforceSameOriginRequest(request);

  if (originResponse) {
    return originResponse;
  }

  if (options.requireJson) {
    return enforceJsonRequest(request);
  }

  return null;
}
