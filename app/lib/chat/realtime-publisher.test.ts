import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { internalRealtimeSecretHeader } from "../../../shared/realtime-internal";
import { publishChatMessage, resolveChatMessageUrl } from "./realtime-publisher";

const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalFetch = globalThis.fetch;
const originalClearTimeout = globalThis.clearTimeout;
const clearTimeoutMock = mock((timeoutId: Parameters<typeof clearTimeout>[0]) => {
  originalClearTimeout(timeoutId);
});
const envKeys = [
  "BETTER_AUTH_SECRET",
  "REALTIME_INTERNAL_SECRET",
  "REALTIME_INTERNAL_URL",
  "REALTIME_PUBLISH_TIMEOUT_MS",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  (typeof envKeys)[number],
  string | undefined
>;

const createdAt = new Date("2026-05-23T10:00:00.000Z");
const payload = {
  conversationId: "conv-1",
  message: {
    id: "msg-1",
    body: "hello",
    createdAt,
    sender: {
      id: "user-alice",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    },
  },
};

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function expectRejectsWithMessage(action: () => Promise<unknown>, message: string) {
  let thrown: unknown;

  try {
    await action();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Error);

  if (thrown instanceof Error) {
    expect(thrown.message).toContain(message);
  }
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  clearTimeoutMock.mockReset();
  clearTimeoutMock.mockImplementation((timeoutId: Parameters<typeof clearTimeout>[0]) => {
    originalClearTimeout(timeoutId);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  globalThis.clearTimeout = clearTimeoutMock as unknown as typeof clearTimeout;

  for (const key of envKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.clearTimeout = originalClearTimeout;
  restoreEnv();
});

describe("resolveChatMessageUrl", () => {
  test("derives the chat endpoint from the game endpoint", () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";

    expect(resolveChatMessageUrl()).toBe("http://localhost:3001/internal/chat-message");
  });

  test("defaults to the realtime service chat endpoint", () => {
    expect(resolveChatMessageUrl()).toBe("http://realtime:3001/internal/chat-message");
  });
});

describe("publishChatMessage", () => {
  test("posts serialized chat messages with the internal header and no-store cache", async () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";
    process.env["REALTIME_INTERNAL_SECRET"] = "chat-secret";

    await publishChatMessage(payload, 5000);

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call).toBeDefined();

    const [url, init] = call!;

    expect(url).toBe("http://localhost:3001/internal/chat-message");
    expect(init).toMatchObject({
      cache: "no-store",
      method: "POST",
      body: JSON.stringify({
        conversationId: "conv-1",
        message: {
          ...payload.message,
          createdAt: createdAt.toISOString(),
        },
      }),
    });
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: "chat-secret",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
  });

  test("falls back to the Better Auth secret when no dedicated secret is configured", async () => {
    process.env["BETTER_AUTH_SECRET"] = "auth-secret";

    await publishChatMessage(payload);

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call?.[1].headers).toMatchObject({
      [internalRealtimeSecretHeader]: "auth-secret",
    });
  });

  test("throws on missing secrets and failed realtime responses", async () => {
    await expectRejectsWithMessage(
      () => publishChatMessage(payload),
      "Missing REALTIME_INTERNAL_SECRET",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    process.env["REALTIME_INTERNAL_SECRET"] = "chat-secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expectRejectsWithMessage(
      () => publishChatMessage(payload),
      "Realtime server returned 503",
    );
    expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
  });
});
