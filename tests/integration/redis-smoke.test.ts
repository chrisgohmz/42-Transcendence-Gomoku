import { describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";

import type Redis from "ioredis";

await mock.module("server-only", () => ({}));

const shouldRunRedisSmoke =
  process.env["RUN_REDIS_SMOKE"] === "true" || Boolean(process.env["REDIS_SMOKE_URL"]?.trim());
const redisSmokeTest = shouldRunRedisSmoke ? test : test.skip;

function getRedisSmokeUrl() {
  const redisUrl = process.env["REDIS_SMOKE_URL"]?.trim();

  if (!redisUrl) {
    throw new Error(
      "Set REDIS_SMOKE_URL to a password-bearing Redis URL, for example redis://:password@127.0.0.1:6379/0.",
    );
  }

  const parsed = new URL(redisUrl);

  if (!parsed.password) {
    throw new Error("REDIS_SMOKE_URL must include a Redis password.");
  }

  return redisUrl;
}

async function deleteKeysByPattern(redis: Redis, pattern: string) {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    cursor = nextCursor;
  } while (cursor !== "0");
}

describe("Redis integration smoke", () => {
  redisSmokeTest("runs rate-limit and presence paths against password-auth Redis", async () => {
    const [{ consumeRateLimit }, { createRedisPresenceStore }, { createRedisClient }] =
      await Promise.all([
        import("../../app/lib/rate-limit"),
        import("../../realtime/lib/presence"),
        import("../../shared/server/redis"),
      ]);
    const redisUrl = getRedisSmokeUrl();
    const redis = createRedisClient(redisUrl);
    const testKeyPrefix = `transcendence:test:${randomUUID()}:`;

    try {
      await redis.connect();

      const headers = new Headers({ "X-Forwarded-For": "198.51.100.42" });
      const rule = {
        key: "redis-smoke",
        max: 1,
        windowSeconds: 60,
      };
      const rateLimitEnv = {
        NODE_ENV: "production",
        RATE_LIMIT_REDIS_KEY_PREFIX: `${testKeyPrefix}rate-limit:`,
      } as NodeJS.ProcessEnv;

      const first = await consumeRateLimit(headers, rule, {
        env: rateLimitEnv,
        now: 1_700_000_000_000,
        redis,
      });
      const second = await consumeRateLimit(headers, rule, {
        env: rateLimitEnv,
        now: 1_700_000_001_000,
        redis,
      });

      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(0);
      expect(second.allowed).toBe(false);

      const presenceStore = createRedisPresenceStore(redis, {
        keyPrefix: `${testKeyPrefix}presence:`,
        ttlSeconds: 60,
      });

      expect(await presenceStore.addConnection("socket-ada", "ada")).toEqual(["ada"]);
      expect(await presenceStore.addConnection("socket-grace", "grace")).toEqual(["ada", "grace"]);
      expect(await presenceStore.getActiveUsernames()).toEqual(["ada", "grace"]);
      expect(await presenceStore.removeConnection("socket-ada")).toEqual(["grace"]);
      expect(await presenceStore.removeConnection("socket-grace")).toEqual([]);
    } finally {
      await deleteKeysByPattern(redis, `${testKeyPrefix}*`).catch(() => undefined);
      redis.disconnect();
    }
  });
});
