export const DEFAULT_SOCKET_HEARTBEAT_INTERVAL_MS = 15_000;
export const DEFAULT_SOCKET_PING_INTERVAL_MS = 15_000;
export const DEFAULT_SOCKET_PING_TIMEOUT_MS = 10_000;

export type HeartbeatPayload = {
  timestamp: string;
};

export type WelcomePayload = {
  message: string;
  username?: string;
};

type LifecycleSocket = {
  data: {
    user?: {
      username?: string | null;
    };
  };
  emit(event: "heartbeat", payload: HeartbeatPayload): unknown;
  emit(event: "welcome", payload: WelcomePayload): unknown;
};

type IntervalHandle = ReturnType<typeof setInterval>;

type SocketLifecycleOptions = {
  clearIntervalFn?: (handle: IntervalHandle) => void;
  heartbeatIntervalMs?: number;
  now?: () => Date;
  onHeartbeat?: () => Promise<void> | void;
  setIntervalFn?: (callback: () => void, intervalMs: number) => IntervalHandle;
};

export function readPositiveIntegerEnv(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
) {
  const value = env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createHeartbeatPayload(now: () => Date = () => new Date()): HeartbeatPayload {
  return {
    timestamp: now().toISOString(),
  };
}

export function emitHeartbeat(socket: LifecycleSocket, now?: () => Date) {
  socket.emit("heartbeat", createHeartbeatPayload(now));
}

export function startSocketLifecycle(
  socket: LifecycleSocket,
  {
    clearIntervalFn = clearInterval,
    heartbeatIntervalMs = DEFAULT_SOCKET_HEARTBEAT_INTERVAL_MS,
    now = () => new Date(),
    onHeartbeat,
    setIntervalFn = setInterval,
  }: SocketLifecycleOptions = {},
) {
  const username = socket.data.user?.username ?? undefined;

  socket.emit("welcome", {
    message: "Connected to realtime service",
    ...(username ? { username } : {}),
  });

  const heartbeatTimer = setIntervalFn(() => {
    emitHeartbeat(socket, now);
    void onHeartbeat?.();
  }, heartbeatIntervalMs);

  return () => {
    clearIntervalFn(heartbeatTimer);
  };
}
