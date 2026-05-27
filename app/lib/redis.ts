import Redis, { type RedisOptions } from "ioredis";

const defaultRedisConnectTimeoutMs = 500;

type RedisEnv = Record<string, string | undefined>;

type SharedRedisClientOptions = RedisOptions & {
  cacheKey: string;
  connectTimeoutEnvName?: string;
  env?: RedisEnv;
  url: string;
  warningMessage?: string;
};

type RedisClientOptions = RedisOptions & {
  connectTimeoutEnvName?: string;
  env?: RedisEnv;
};

type ConnectableRedisClient = {
  connect?: () => Promise<unknown>;
  status?: string;
};

const globalRedisStore = globalThis as typeof globalThis & {
  __transcendenceRedisClientUrls?: Map<string, string>;
  __transcendenceRedisClients?: Map<string, Redis>;
  __transcendenceRedisWarnings?: Set<string>;
};

function getSharedClients() {
  return (globalRedisStore.__transcendenceRedisClients ??= new Map());
}

function getSharedClientUrls() {
  return (globalRedisStore.__transcendenceRedisClientUrls ??= new Map());
}

function getSharedWarnings() {
  return (globalRedisStore.__transcendenceRedisWarnings ??= new Set());
}

export function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readRedisUrl(env: RedisEnv, names: readonly string[]): string | null {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function createRedisClient(
  url: string,
  {
    connectTimeoutEnvName = "REDIS_CONNECT_TIMEOUT_MS",
    env = process.env,
    ...options
  }: RedisClientOptions = {},
): Redis {
  return new Redis(url, {
    connectTimeout: readPositiveInteger(
      env[connectTimeoutEnvName] ?? env["REDIS_CONNECT_TIMEOUT_MS"],
      defaultRedisConnectTimeoutMs,
    ),
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    ...options,
  });
}

export function getSharedRedisClient({
  cacheKey,
  connectTimeoutEnvName,
  env = process.env,
  url,
  warningMessage,
  ...options
}: SharedRedisClientOptions): Redis {
  const clients = getSharedClients();
  const clientUrls = getSharedClientUrls();
  const warnings = getSharedWarnings();
  const existingClient = clients.get(cacheKey);

  if (existingClient && clientUrls.get(cacheKey) === url) {
    return existingClient;
  }

  existingClient?.disconnect();
  warnings.delete(cacheKey);

  const redis = createRedisClient(url, {
    connectTimeoutEnvName,
    env,
    connectionName: cacheKey,
    ...options,
  });

  if (warningMessage) {
    redis.on("error", () => {
      if (warnings.has(cacheKey)) {
        return;
      }

      warnings.add(cacheKey);
      console.warn(warningMessage);
    });
  }

  clients.set(cacheKey, redis);
  clientUrls.set(cacheKey, url);

  return redis;
}

export async function connectRedisClient(redis: ConnectableRedisClient) {
  if (redis.status === "wait" && redis.connect) {
    await redis.connect();
  }
}
