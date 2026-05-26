import "server-only";

type HeaderReader = Pick<Headers, "get">;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitRule = {
  key: string;
  max: number;
  subject?: string | null;
  windowSeconds: number;
};

export type RateLimitResult =
  | {
      allowed: true;
      headers: Headers;
      limit: number;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      headers: Headers;
      limit: number;
      remaining: 0;
      resetAt: number;
      retryAfterSeconds: number;
    };

const maxBuckets = 10_000;

const globalRateLimitStore = globalThis as typeof globalThis & {
  __transcendenceRateLimitBuckets?: Map<string, RateLimitBucket>;
};

const buckets = (globalRateLimitStore.__transcendenceRateLimitBuckets ??= new Map());

function getFirstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function getClientIp(headers?: HeaderReader | null): string {
  return (
    getFirstHeaderValue(headers?.get("cf-connecting-ip") ?? null) ??
    getFirstHeaderValue(headers?.get("x-real-ip") ?? null) ??
    getFirstHeaderValue(headers?.get("x-forwarded-for") ?? null) ??
    "unknown"
  );
}

function isRateLimitDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["RATE_LIMIT_DISABLED"] === "true" || env["NODE_ENV"] === "test";
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < maxBuckets) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function buildHeaders({
  limit,
  remaining,
  resetAt,
  retryAfterSeconds,
}: {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}) {
  const headers = new Headers({
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  });

  if (retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(retryAfterSeconds));
    headers.set("X-Retry-After", String(retryAfterSeconds));
  }

  return headers;
}

export function consumeRateLimit(headers: HeaderReader | null | undefined, rule: RateLimitRule) {
  const now = Date.now();
  const windowMs = Math.max(1, rule.windowSeconds) * 1000;
  const resetAt = now + windowMs;

  if (isRateLimitDisabled()) {
    return {
      allowed: true,
      headers: buildHeaders({ limit: rule.max, remaining: rule.max, resetAt }),
      limit: rule.max,
      remaining: rule.max,
      resetAt,
    } satisfies RateLimitResult;
  }

  pruneExpiredBuckets(now);

  const subject = rule.subject?.trim() || `ip:${getClientIp(headers)}`;
  const key = `${rule.key}:${subject}`;
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt };

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, rule.max - bucket.count);

  if (bucket.count > rule.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return {
      allowed: false,
      headers: buildHeaders({
        limit: rule.max,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds,
      }),
      limit: rule.max,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds,
    } satisfies RateLimitResult;
  }

  return {
    allowed: true,
    headers: buildHeaders({ limit: rule.max, remaining, resetAt: bucket.resetAt }),
    limit: rule.max,
    remaining,
    resetAt: bucket.resetAt,
  } satisfies RateLimitResult;
}

export function rateLimitResponse(result: Extract<RateLimitResult, { allowed: false }>) {
  return Response.json(
    {
      error: "rate_limited",
      message: "Too many requests. Try again later.",
    },
    {
      headers: result.headers,
      status: 429,
    },
  );
}
