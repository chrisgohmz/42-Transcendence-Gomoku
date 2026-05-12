import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { internalRealtimeSecretHeader } from "../../../shared/realtime-internal";
import { publishFriendshipUpdate, resolveFriendshipUpdateUrl } from "./realtime-publisher";

const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalFetch = globalThis.fetch;
const envKeys = [
  "BETTER_AUTH_SECRET",
  "REALTIME_FRIENDSHIP_INTERNAL_URL",
  "REALTIME_INTERNAL_SECRET",
  "REALTIME_INTERNAL_URL",
  "REALTIME_PUBLISH_TIMEOUT_MS",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  (typeof envKeys)[number],
  string | undefined
>;

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
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  for (const key of envKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

describe("resolveFriendshipUpdateUrl", () => {
  test("uses the explicit friendship endpoint when configured", () => {
    process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"] =
      "http://localhost:3001/internal/friendship-update";
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";

    expect(resolveFriendshipUpdateUrl()).toBe("http://localhost:3001/internal/friendship-update");
  });

  test("derives the friendship endpoint from the game endpoint", () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";

    expect(resolveFriendshipUpdateUrl()).toBe("http://localhost:3001/internal/friendship-update");
  });
});

describe("publishFriendshipUpdate", () => {
  test("posts unique usernames with the internal header and no-store cache", async () => {
    process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"] =
      "http://localhost:3001/internal/friendship-update";
    process.env["REALTIME_INTERNAL_SECRET"] = "friend-secret";

    await publishFriendshipUpdate(["alice", "bob", "alice"], 5000);

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call).toBeDefined();

    const [url, init] = call!;

    expect(url).toBe("http://localhost:3001/internal/friendship-update");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ usernames: ["alice", "bob"] }),
    });
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: "friend-secret",
    });
  });

  test("falls back to the Better Auth secret when no dedicated secret is configured", async () => {
    process.env["BETTER_AUTH_SECRET"] = "auth-secret";

    await publishFriendshipUpdate(["alice"]);

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call?.[1].headers).toMatchObject({
      [internalRealtimeSecretHeader]: "auth-secret",
    });
  });

  test("throws on missing secrets and failed realtime responses", async () => {
    await expectRejectsWithMessage(
      () => publishFriendshipUpdate(["alice"]),
      "Missing REALTIME_INTERNAL_SECRET",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    process.env["REALTIME_INTERNAL_SECRET"] = "friend-secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expectRejectsWithMessage(
      () => publishFriendshipUpdate(["alice"]),
      "Failed to publish friendship:refresh(503)",
    );
  });
});
