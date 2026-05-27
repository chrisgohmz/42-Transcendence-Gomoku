import { describe, expect, mock, test } from "bun:test";

import {
  createHeartbeatPayload,
  readPositiveIntegerEnv,
  startSocketLifecycle,
} from "./socket-lifecycle";

describe("createHeartbeatPayload", () => {
  test("uses an ISO timestamp from the provided clock", () => {
    const payload = createHeartbeatPayload(() => new Date("2026-05-10T12:30:00.000Z"));

    expect(payload).toEqual({ timestamp: "2026-05-10T12:30:00.000Z" });
  });
});

describe("readPositiveIntegerEnv", () => {
  test("keeps valid positive integer values", () => {
    expect(
      readPositiveIntegerEnv({ SOCKET_PING_TIMEOUT_MS: "7500" }, "SOCKET_PING_TIMEOUT_MS", 1),
    ).toBe(7500);
  });

  test("falls back for missing, non-integer, or non-positive values", () => {
    expect(readPositiveIntegerEnv({}, "SOCKET_PING_TIMEOUT_MS", 1000)).toBe(1000);
    expect(
      readPositiveIntegerEnv({ SOCKET_PING_TIMEOUT_MS: "1.5" }, "SOCKET_PING_TIMEOUT_MS", 1000),
    ).toBe(1000);
    expect(
      readPositiveIntegerEnv({ SOCKET_PING_TIMEOUT_MS: "0" }, "SOCKET_PING_TIMEOUT_MS", 1000),
    ).toBe(1000);
  });
});

describe("startSocketLifecycle", () => {
  test("sends welcome immediately and schedules heartbeat payloads", () => {
    const intervalHandle = 7 as unknown as ReturnType<typeof setInterval>;
    const emit = mock();
    const onHeartbeat = mock();
    const clearIntervalFn = mock();
    const scheduledCallbacks: Array<() => void> = [];
    const setIntervalFn = mock((callback: () => void, intervalMs: number) => {
      scheduledCallbacks.push(callback);
      expect(intervalMs).toBe(5000);
      return intervalHandle;
    });

    const stop = startSocketLifecycle(
      {
        data: { user: { username: "ada" } },
        emit,
      },
      {
        clearIntervalFn,
        heartbeatIntervalMs: 5000,
        now: () => new Date("2026-05-10T12:30:00.000Z"),
        onHeartbeat,
        setIntervalFn,
      },
    );

    expect(emit).toHaveBeenCalledWith("welcome", {
      message: "Connected to realtime service",
      username: "ada",
    });
    expect(setIntervalFn).toHaveBeenCalledTimes(1);

    scheduledCallbacks[0]?.();

    expect(emit).toHaveBeenCalledWith("heartbeat", {
      timestamp: "2026-05-10T12:30:00.000Z",
    });
    expect(onHeartbeat).toHaveBeenCalledTimes(1);

    stop();

    expect(clearIntervalFn).toHaveBeenCalledWith(intervalHandle);
  });
});
