import { describe, expect, mock, test } from "bun:test";

await mock.module("server-only", () => ({}));

const { consumeRateLimit, getClientIp, rateLimitResponse } = await import("./rate-limit");

const productionEnv = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

function productionOptions(now: number, store = new Map()) {
  return { env: productionEnv, now, store };
}

describe("rate limiting", () => {
  test("uses only the proxy-controlled x-forwarded-for client address", () => {
    const headers = new Headers({
      "CF-Connecting-IP": "203.0.113.10",
      "X-Forwarded-For": "198.51.100.7, 10.0.0.2",
      "X-Real-IP": "203.0.113.11",
    });

    expect(getClientIp(headers)).toBe("198.51.100.7");
  });

  test("falls back to an unknown IP subject when no forwarded address is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  test("can be explicitly enabled in test environments", async () => {
    const now = 1_700_000_000_000;
    const store = new Map();
    const headers = new Headers({ "X-Forwarded-For": "198.51.100.7" });
    const rule = { key: "test:enabled", max: 1, windowSeconds: 60 };
    const env = { NODE_ENV: "test", RATE_LIMIT_DISABLED: "false" } as NodeJS.ProcessEnv;

    expect((await consumeRateLimit(headers, rule, { env, now, store })).allowed).toBe(true);
    expect((await consumeRateLimit(headers, rule, { env, now, store })).allowed).toBe(false);
  });

  test("allows requests through the limit and then returns retry headers", async () => {
    const now = 1_700_000_000_000;
    const store = new Map();
    const headers = new Headers({ "X-Forwarded-For": "198.51.100.7" });
    const rule = { key: "test:action", max: 2, windowSeconds: 60 };

    const first = await consumeRateLimit(headers, rule, productionOptions(now, store));
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(first.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(first.headers.get("X-RateLimit-Remaining")).toBe("1");

    const second = await consumeRateLimit(headers, rule, productionOptions(now + 1_000, store));
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = await consumeRateLimit(headers, rule, productionOptions(now + 2_000, store));
    expect(third.allowed).toBe(false);

    if (third.allowed) {
      throw new Error("expected third request to be rate limited");
    }

    expect(third.retryAfterSeconds).toBe(58);
    expect(third.headers.get("Retry-After")).toBe("58");
    expect(third.headers.get("X-Retry-After")).toBe("58");
  });

  test("resets a bucket after the fixed window expires", async () => {
    const now = 1_700_000_000_000;
    const store = new Map();
    const headers = new Headers({ "X-Forwarded-For": "198.51.100.7" });
    const rule = { key: "test:reset", max: 1, windowSeconds: 60 };

    expect((await consumeRateLimit(headers, rule, productionOptions(now, store))).allowed).toBe(
      true,
    );
    expect(
      (await consumeRateLimit(headers, rule, productionOptions(now + 1_000, store))).allowed,
    ).toBe(false);
    expect(
      (await consumeRateLimit(headers, rule, productionOptions(now + 61_000, store))).allowed,
    ).toBe(true);
  });

  test("separates explicit user subjects from IP buckets", async () => {
    const now = 1_700_000_000_000;
    const store = new Map();
    const headers = new Headers({ "X-Forwarded-For": "198.51.100.7" });
    const rule = { key: "test:user", max: 1, windowSeconds: 60 };

    expect(
      (
        await consumeRateLimit(
          headers,
          { ...rule, subject: "user:alice" },
          productionOptions(now, store),
        )
      ).allowed,
    ).toBe(true);
    expect(
      (
        await consumeRateLimit(
          headers,
          { ...rule, subject: "user:alice" },
          productionOptions(now, store),
        )
      ).allowed,
    ).toBe(false);
    expect(
      (
        await consumeRateLimit(
          headers,
          { ...rule, subject: "user:bob" },
          productionOptions(now, store),
        )
      ).allowed,
    ).toBe(true);
  });

  test("uses a supplied Redis store with the shared key prefix", async () => {
    const now = 1_700_000_000_000;
    const headers = new Headers({ "X-Forwarded-For": "198.51.100.7" });
    const rule = { key: "test:redis", max: 1, windowSeconds: 60 };
    const evalCalls: Array<[string, number, string, string]> = [];
    let status = "wait";
    let count = 0;
    const redis = {
      get status() {
        return status;
      },
      connect: mock(async () => {
        status = "ready";
      }),
      eval: mock(async (_script: string, keyCount: number, key: string, windowMs: string) => {
        evalCalls.push([_script, keyCount, key, windowMs]);
        count += 1;
        return [count, 60_000 - (count - 1) * 1_000];
      }),
    };

    const first = await consumeRateLimit(headers, rule, { env: productionEnv, now, redis });
    const second = await consumeRateLimit(headers, rule, {
      env: productionEnv,
      now: now + 1_000,
      redis,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(redis.connect).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(evalCalls[0]?.[1]).toBe(1);
    expect(evalCalls[0]?.[2]).toBe("transcendence:rate-limit:test:redis:ip:198.51.100.7");
    expect(evalCalls[0]?.[3]).toBe("60000");

    if (second.allowed) {
      throw new Error("expected second request to be rate limited");
    }

    expect(second.retryAfterSeconds).toBe(59);
  });

  test("builds a 429 JSON response with rate-limit headers", async () => {
    const now = 1_700_000_000_000;
    const store = new Map();
    const headers = new Headers({ "X-Forwarded-For": "198.51.100.7" });
    const rule = { key: "test:response", max: 1, windowSeconds: 60 };

    await consumeRateLimit(headers, rule, productionOptions(now, store));
    const result = await consumeRateLimit(headers, rule, productionOptions(now, store));

    if (result.allowed) {
      throw new Error("expected request to be rate limited");
    }

    const response = rateLimitResponse(result);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({
      error: "rate_limited",
      message: "Too many requests. Try again later.",
    });
  });
});
