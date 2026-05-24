const originEnvKeys = ["BETTER_AUTH_TRUSTED_ORIGINS", "CADDY_SITE_ADDRESS", "BETTER_AUTH_URL"];

function getFirstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function splitOriginList(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? []
  );
}

export function getConfiguredAuthBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return normalizeOrigin(env["BETTER_AUTH_URL"] ?? "");
}

export function getTrustedAuthOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = new Set<string>();

  for (const key of originEnvKeys) {
    for (const rawOrigin of splitOriginList(env[key])) {
      const origin = normalizeOrigin(rawOrigin);

      if (origin) {
        origins.add(origin);
      }
    }
  }

  return Array.from(origins);
}

export function getTrustedAuthHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  return getTrustedAuthOrigins(env)
    .map((origin) => {
      try {
        return new URL(origin).host;
      } catch {
        return null;
      }
    })
    .filter((host): host is string => Boolean(host));
}

export function getRequestOrigin(headers?: Headers, requestUrl?: string): string | null {
  const origin = normalizeOrigin(headers?.get("origin") ?? "");

  if (origin) {
    return origin;
  }

  const forwardedHost = getFirstHeaderValue(headers?.get("x-forwarded-host") ?? null);
  const host = forwardedHost ?? headers?.get("host")?.trim();

  if (host) {
    const forwardedProto = getFirstHeaderValue(headers?.get("x-forwarded-proto") ?? null);
    const proto = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
    return normalizeOrigin(`${proto}://${host}`);
  }

  if (requestUrl) {
    return normalizeOrigin(requestUrl);
  }

  return null;
}

export function isTrustedAuthOrigin(origin: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const trustedOrigins = getTrustedAuthOrigins(env);

  if (trustedOrigins.length === 0) {
    return true;
  }

  return trustedOrigins.includes(origin);
}
