import { describe, expect, mock, test } from "bun:test";

import type { createAdapter } from "@socket.io/redis-adapter";

import type { createRedisClient } from "../../shared/server/redis";
import type { createRedisPresenceStore, PresenceStore } from "./presence";
import { createRedisBackedPresenceStore, getRealtimeRedisErrorMessage } from "./redis-presence";

type FakeRedisClient = {
  del: ReturnType<typeof mock>;
  disconnect: ReturnType<typeof mock>;
  duplicate: ReturnType<typeof mock>;
  mget: ReturnType<typeof mock>;
  name: string;
  sadd: ReturnType<typeof mock>;
  setex: ReturnType<typeof mock>;
  smembers: ReturnType<typeof mock>;
  srem: ReturnType<typeof mock>;
};

function createFakeRedisClient(name: string, duplicateClient?: FakeRedisClient): FakeRedisClient {
  return {
    name,
    del: mock(async () => undefined),
    disconnect: mock(() => undefined),
    duplicate: mock(() => duplicateClient ?? createFakeRedisClient(`${name}:sub`)),
    mget: mock(async () => []),
    sadd: mock(async () => undefined),
    setex: mock(async () => undefined),
    smembers: mock(async () => []),
    srem: mock(async () => undefined),
  };
}

describe("createRedisBackedPresenceStore", () => {
  test("does not create Redis clients when no realtime Redis URL is configured", async () => {
    const io = { adapter: mock() };
    const createRedisClientFn = mock(() => {
      throw new Error("should not create Redis client");
    });

    const result = await createRedisBackedPresenceStore({
      createRedisClientFn: createRedisClientFn as unknown as typeof createRedisClient,
      env: { NODE_ENV: "development" },
      io,
      presenceTtlSeconds: 60,
    });

    expect(result).toBeNull();
    expect(createRedisClientFn).not.toHaveBeenCalled();
    expect(io.adapter).not.toHaveBeenCalled();
  });

  test("installs the Socket.IO Redis adapter and Redis presence store", async () => {
    const subClient = createFakeRedisClient("sub");
    const pubClient = createFakeRedisClient("pub", subClient);
    const presenceClient = createFakeRedisClient("presence");
    const adapter = {};
    const presenceStore = {} as PresenceStore;
    const io = { adapter: mock() };
    const logger = { log: mock(), warn: mock() };
    let createClientCalls = 0;
    const createRedisClientFn = mock((url: string) => {
      createClientCalls += 1;
      expect(url).toBe("redis://redis:6379/0");
      return createClientCalls === 1 ? pubClient : presenceClient;
    });
    const connectRedisClientFn = mock(async () => undefined);
    const createAdapterFn = mock(() => adapter);
    const createPresenceStoreFn = mock(() => presenceStore);

    const result = await createRedisBackedPresenceStore({
      connectRedisClientFn,
      createAdapterFn: createAdapterFn as unknown as typeof createAdapter,
      createPresenceStoreFn: createPresenceStoreFn as unknown as typeof createRedisPresenceStore,
      createRedisClientFn: createRedisClientFn as unknown as typeof createRedisClient,
      env: {
        NODE_ENV: "production",
        REALTIME_PRESENCE_REDIS_KEY_PREFIX: "test:presence:",
        REALTIME_REDIS_URL: "redis://redis:6379/0",
      },
      io,
      logger,
      presenceTtlSeconds: 45,
    });

    expect(result).toBe(presenceStore);
    expect(pubClient.duplicate).toHaveBeenCalledWith({
      connectionName: "transcendence-realtime-sub",
    });
    expect(connectRedisClientFn).toHaveBeenCalledTimes(3);
    expect(createAdapterFn).toHaveBeenCalledWith(pubClient, subClient);
    expect(io.adapter).toHaveBeenCalledWith(adapter);
    expect(createPresenceStoreFn).toHaveBeenCalledWith(presenceClient, {
      keyPrefix: "test:presence:",
      ttlSeconds: 45,
    });
    expect(logger.log).toHaveBeenCalledWith("[realtime] Redis adapter and presence store enabled.");
  });

  test("falls back to in-memory presence in development when Redis setup fails", async () => {
    const subClient = createFakeRedisClient("sub");
    const pubClient = createFakeRedisClient("pub", subClient);
    const presenceClient = createFakeRedisClient("presence");
    const io = { adapter: mock() };
    const logger = { log: mock(), warn: mock() };
    let createClientCalls = 0;
    const createRedisClientFn = mock(() => {
      createClientCalls += 1;
      return createClientCalls === 1 ? pubClient : presenceClient;
    });
    const connectRedisClientFn = mock(async () => {
      throw new Error("ECONNREFUSED redis.internal:6379");
    });

    const result = await createRedisBackedPresenceStore({
      connectRedisClientFn,
      createRedisClientFn: createRedisClientFn as unknown as typeof createRedisClient,
      env: {
        NODE_ENV: "development",
        REALTIME_REDIS_URL: "redis://redis:6379/0",
      },
      io,
      logger,
      presenceTtlSeconds: 60,
    });

    expect(result).toBeNull();
    expect(pubClient.disconnect).toHaveBeenCalled();
    expect(subClient.disconnect).toHaveBeenCalled();
    expect(presenceClient.disconnect).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "[realtime] Redis is unavailable; using in-memory adapter and presence. ECONNREFUSED redis.internal:6379",
    );
    expect(logger.warn.mock.calls[0]?.length).toBe(1);
  });

  test("fails startup in production when Redis setup fails", async () => {
    const subClient = createFakeRedisClient("sub");
    const pubClient = createFakeRedisClient("pub", subClient);
    const presenceClient = createFakeRedisClient("presence");
    const io = { adapter: mock() };
    const logger = { log: mock(), warn: mock() };
    let createClientCalls = 0;
    const createRedisClientFn = mock(() => {
      createClientCalls += 1;
      return createClientCalls === 1 ? pubClient : presenceClient;
    });
    const connectRedisClientFn = mock(async () => {
      throw new Error("ECONNREFUSED redis.internal:6379");
    });

    let thrownError: unknown;

    try {
      await createRedisBackedPresenceStore({
        connectRedisClientFn,
        createRedisClientFn: createRedisClientFn as unknown as typeof createRedisClient,
        env: {
          NODE_ENV: "production",
          REALTIME_REDIS_URL: "redis://redis:6379/0",
        },
        io,
        logger,
        presenceTtlSeconds: 60,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe("ECONNREFUSED redis.internal:6379");

    expect(pubClient.disconnect).toHaveBeenCalled();
    expect(subClient.disconnect).toHaveBeenCalled();
    expect(presenceClient.disconnect).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("getRealtimeRedisErrorMessage", () => {
  test("returns only a sanitized message string", () => {
    expect(getRealtimeRedisErrorMessage(new Error("redis down"))).toBe("redis down");
    expect(getRealtimeRedisErrorMessage(new Error("failed redis://:secret@redis:6379/0"))).toBe(
      "failed redis://[redacted]@redis:6379/0",
    );
    expect(getRealtimeRedisErrorMessage({ message: "not an Error" })).toBe("Unknown error");
  });
});
