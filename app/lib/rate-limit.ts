import "server-only";
import { connectRedisClient, getSharedRedisClient, readRedisUrl } from "../../shared/server/redis";

type HeaderReader = Pick<Headers, "get">;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitRedisStore = {
  connect?: () => Promise<unknown>;
  eval: (script: string, keyCount: number, key: string, windowMs: string) => Promise<unknown>;
  status?: string;
};

type RateLimitOptions = {
  env?: NodeJS.ProcessEnv;
  now?: number;
  redis?: RateLimitRedisStore | null;
  store?: Map<string, RateLimitBucket>;
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
const defaultRedisKeyPrefix = "transcendence:rate-limit:";
const redisRateLimitScript = `
local count = redis.call("INCR", KEYS[1])

if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  return { count, ARGV[1] }
end

local ttl = redis.call("PTTL", KEYS[1])

if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = ARGV[1]
end

return { count, ttl }
`;

const globalRateLimitStore = globalThis as typeof globalThis & {
  __transcendenceRateLimitBuckets?: Map<string, RateLimitBucket>;
  __transcendenceRateLimitRedisWarned?: boolean;
};

const buckets = (globalRateLimitStore.__transcendenceRateLimitBuckets ??= new Map());

function getFirstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function getClientIp(headers?: HeaderReader | null): string {
  return getFirstHeaderValue(headers?.get("x-forwarded-for") ?? null) ?? "unknown";
}

function isRateLimitDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env["RATE_LIMIT_DISABLED"] === "false") {
    return false;
  }

  return env["RATE_LIMIT_DISABLED"] === "true" || env["NODE_ENV"] === "test";
}

function getRedisUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return readRedisUrl(env, ["RATE_LIMIT_REDIS_URL", "REDIS_URL"]);
}

function getRedisKeyPrefix(env: NodeJS.ProcessEnv = process.env): string {
  return env["RATE_LIMIT_REDIS_KEY_PREFIX"]?.trim() || defaultRedisKeyPrefix;
}

function getRateLimitRedisClient(env: NodeJS.ProcessEnv = process.env): RateLimitRedisStore | null {
  const redisUrl = getRedisUrl(env);

  if (!redisUrl) {
    return null;
  }

  return getSharedRedisClient({
    cacheKey: "rate-limit",
    connectTimeoutEnvName: "RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS",
    env,
    url: redisUrl,
    warningMessage: "[rate-limit] Redis is unavailable.",
  });
}

function isRedisFailOpenEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env["RATE_LIMIT_REDIS_FAIL_OPEN"]?.trim().toLowerCase();

  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }

  if (value === "false" || value === "0" || value === "no") {
    return false;
  }

  return env["NODE_ENV"] !== "production";
}

function pruneExpiredBuckets(now: number, store: Map<string, RateLimitBucket>) {
  if (store.size < maxBuckets) {
    return;
  }

  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
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

function toRateLimitResult(
  rule: RateLimitRule,
  count: number,
  resetAt: number,
  now: number = Date.now(),
): RateLimitResult {
  const remaining = Math.max(0, rule.max - count);

  if (count > rule.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    return {
      allowed: false,
      headers: buildHeaders({
        limit: rule.max,
        remaining: 0,
        resetAt,
        retryAfterSeconds,
      }),
      limit: rule.max,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    } satisfies RateLimitResult;
  }

  return {
    allowed: true,
    headers: buildHeaders({ limit: rule.max, remaining, resetAt }),
    limit: rule.max,
    remaining,
    resetAt,
  } satisfies RateLimitResult;
}

function consumeMemoryRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number,
  windowMs: number,
  store: Map<string, RateLimitBucket>,
): RateLimitResult {
  pruneExpiredBuckets(now, store);

  const resetAt = now + windowMs;
  const current = store.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt };

  bucket.count += 1;
  store.set(key, bucket);

  return toRateLimitResult(rule, bucket.count, bucket.resetAt, now);
}

function parseRedisRateLimitResult(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("Unexpected Redis rate-limit response");
  }

  const count = Number(value[0]);
  const ttlMs = Number(value[1]);

  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
    throw new Error("Invalid Redis rate-limit response");
  }

  return {
    count,
    ttlMs: Math.max(0, ttlMs),
  };
}

async function consumeRedisRateLimit(
  redis: RateLimitRedisStore,
  key: string,
  rule: RateLimitRule,
  now: number,
  windowMs: number,
): Promise<RateLimitResult> {
  await connectRedisClient(redis);

  const { count, ttlMs } = parseRedisRateLimitResult(
    await redis.eval(redisRateLimitScript, 1, key, String(windowMs)),
  );

  return toRateLimitResult(rule, count, now + ttlMs, now);
}

function warnRedisFailure(message: string) {
  if (globalRateLimitStore.__transcendenceRateLimitRedisWarned) {
    return;
  }

  globalRateLimitStore.__transcendenceRateLimitRedisWarned = true;
  console.warn(message);
}

function getRateLimitStorageKey(headers: HeaderReader | null | undefined, rule: RateLimitRule) {
  const subject = rule.subject?.trim() || `ip:${getClientIp(headers)}`;
  return `${rule.key}:${subject}`;
}

export async function consumeRateLimit(
  headers: HeaderReader | null | undefined,
  rule: RateLimitRule,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const now = options.now ?? Date.now();
  const windowMs = Math.max(1, rule.windowSeconds) * 1000;
  const resetAt = now + windowMs;

  if (isRateLimitDisabled(options.env)) {
    return {
      allowed: true,
      headers: buildHeaders({ limit: rule.max, remaining: rule.max, resetAt }),
      limit: rule.max,
      remaining: rule.max,
      resetAt,
    } satisfies RateLimitResult;
  }

  const key = getRateLimitStorageKey(headers, rule);

  if (options.store) {
    return consumeMemoryRateLimit(key, rule, now, windowMs, options.store);
  }

  const redis = options.redis === undefined ? getRateLimitRedisClient(options.env) : options.redis;

  if (redis) {
    try {
      return await consumeRedisRateLimit(
        redis,
        `${getRedisKeyPrefix(options.env)}${key}`,
        rule,
        now,
        windowMs,
      );
    } catch {
      if (!isRedisFailOpenEnabled(options.env)) {
        warnRedisFailure("[rate-limit] Redis command failed; failing closed.");
        return toRateLimitResult(rule, rule.max + 1, resetAt, now);
      }

      warnRedisFailure("[rate-limit] Redis command failed; falling back to in-memory counters.");
    }
  }

  return consumeMemoryRateLimit(key, rule, now, windowMs, buckets);
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

export async function enforceRateLimit(
  headers: HeaderReader | null | undefined,
  rule: RateLimitRule,
  options: RateLimitOptions = {},
): Promise<Response | null> {
  const result = await consumeRateLimit(headers, rule, options);
  return result.allowed ? null : rateLimitResponse(result);
}

export async function isRateLimited(
  headers: HeaderReader | null | undefined,
  rule: RateLimitRule,
  options: RateLimitOptions = {},
): Promise<boolean> {
  return !(await consumeRateLimit(headers, rule, options)).allowed;
}
