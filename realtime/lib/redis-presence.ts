import { createAdapter } from "@socket.io/redis-adapter";
import type { Server } from "socket.io";

import { connectRedisClient, createRedisClient, readRedisUrl } from "../../shared/server/redis";
import { createRedisPresenceStore, type PresenceStore } from "./presence";

type RealtimeRedisEnvironment = Record<string, string | undefined>;

type RealtimeRedisLogger = {
  log(message: string): void;
  warn(message: string): void;
};

type RealtimeRedisOptions = {
  connectRedisClientFn?: typeof connectRedisClient;
  createAdapterFn?: typeof createAdapter;
  createPresenceStoreFn?: typeof createRedisPresenceStore;
  createRedisClientFn?: typeof createRedisClient;
  env?: RealtimeRedisEnvironment;
  io: Pick<Server, "adapter">;
  logger?: RealtimeRedisLogger;
  presenceTtlSeconds: number;
};

export function getRealtimeRedisErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }

  return error.message.replace(/\b(redis(?:s)?:\/\/)([^@\s/]+@)/gi, "$1[redacted]@");
}

export async function createRedisBackedPresenceStore({
  connectRedisClientFn = connectRedisClient,
  createAdapterFn = createAdapter,
  createPresenceStoreFn = createRedisPresenceStore,
  createRedisClientFn = createRedisClient,
  env = process.env,
  io,
  logger = console,
  presenceTtlSeconds,
}: RealtimeRedisOptions): Promise<PresenceStore | null> {
  const redisUrl = readRedisUrl(env, ["REALTIME_REDIS_URL", "REDIS_URL"]);

  if (!redisUrl) {
    return null;
  }

  const pubClient = createRedisClientFn(redisUrl, {
    connectionName: "transcendence-realtime-pub",
  });
  const subClient = pubClient.duplicate({
    connectionName: "transcendence-realtime-sub",
  });
  const presenceClient = createRedisClientFn(redisUrl, {
    connectionName: "transcendence-realtime-presence",
  });

  try {
    await Promise.all([
      connectRedisClientFn(pubClient),
      connectRedisClientFn(subClient),
      connectRedisClientFn(presenceClient),
    ]);

    io.adapter(createAdapterFn(pubClient, subClient));
    logger.log("[realtime] Redis adapter and presence store enabled.");

    return createPresenceStoreFn(presenceClient, {
      keyPrefix: env["REALTIME_PRESENCE_REDIS_KEY_PREFIX"]?.trim() || "transcendence:presence:",
      ttlSeconds: presenceTtlSeconds,
    });
  } catch (error) {
    pubClient.disconnect();
    subClient.disconnect();
    presenceClient.disconnect();

    if (env["NODE_ENV"] === "production") {
      throw error;
    }

    logger.warn(
      `[realtime] Redis is unavailable; using in-memory adapter and presence. ${getRealtimeRedisErrorMessage(
        error,
      )}`,
    );
    return null;
  }
}
