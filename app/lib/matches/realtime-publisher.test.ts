import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { GameUpdatePayload } from "../../../shared/match-events";
import { internalRealtimeSecretHeader } from "../../../shared/realtime-internal";
import {
  publishChallengeReceived,
  publishGameUpdate,
  resolveChallengeReceivedUrl,
  resolveGameUpdateUrl,
} from "./realtime-publisher";

const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalFetch = globalThis.fetch;
const envKeys = [
  "BETTER_AUTH_SECRET",
  "REALTIME_CHALLENGE_RECEIVED_URL",
  "REALTIME_INTERNAL_SECRET",
  "REALTIME_INTERNAL_URL",
  "REALTIME_PUBLISH_TIMEOUT_MS",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  (typeof envKeys)[number],
  string | undefined
>;

const payload: GameUpdatePayload = {
  board: [[{ occupied: false }]],
  boardSize: 1,
  endReason: null,
  lastMove: null,
  matchId: "match-1",
  moves: [],
  nextTurnSeat: null,
  participants: [],
  stateVersion: 0,
  status: "WAITING",
  visibility: "PUBLIC",
  winningSeat: null,
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
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  for (const key of envKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

describe("resolveGameUpdateUrl", () => {
  test("uses the explicit game update endpoint when configured", () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";

    expect(resolveGameUpdateUrl()).toBe("http://localhost:3001/internal/game-update");
  });
});

describe("resolveChallengeReceivedUrl", () => {
  test("derives the challenge receive endpoint from the game endpoint", () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";

    expect(resolveChallengeReceivedUrl()).toBe("http://localhost:3001/internal/challenge-received");
  });

  test("uses the explicit challenge receive endpoint when configured", () => {
    process.env["REALTIME_CHALLENGE_RECEIVED_URL"] =
      "http://localhost:3001/custom/challenge-received";

    expect(resolveChallengeReceivedUrl()).toBe("http://localhost:3001/custom/challenge-received");
  });
});

describe("publishGameUpdate", () => {
  test("posts full game state with the internal header and no-store cache", async () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";
    process.env["REALTIME_INTERNAL_SECRET"] = "game-secret";

    await publishGameUpdate(payload, 5000);

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call).toBeDefined();

    const [url, init] = call!;

    expect(url).toBe("http://localhost:3001/internal/game-update");
    expect(init).toMatchObject({
      body: JSON.stringify(payload),
      cache: "no-store",
      method: "POST",
    });
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: "game-secret",
    });
  });

  test("falls back to the Better Auth secret when no dedicated secret is configured", async () => {
    process.env["BETTER_AUTH_SECRET"] = "auth-secret";

    await publishGameUpdate(payload);

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call?.[1].headers).toMatchObject({
      [internalRealtimeSecretHeader]: "auth-secret",
    });
  });

  test("throws on missing secrets and failed realtime responses", async () => {
    await expectRejectsWithMessage(
      () => publishGameUpdate(payload),
      "Missing REALTIME_INTERNAL_SECRET",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    process.env["REALTIME_INTERNAL_SECRET"] = "game-secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expectRejectsWithMessage(
      () => publishGameUpdate(payload),
      "Failed to publish game:update(503)",
    );
  });
});

describe("publishChallengeReceived", () => {
  test("posts challenge invite secrets only to the internal realtime endpoint", async () => {
    process.env["REALTIME_CHALLENGE_RECEIVED_URL"] =
      "http://localhost:3001/internal/challenge-received";
    process.env["REALTIME_INTERNAL_SECRET"] = "game-secret";

    await publishChallengeReceived(
      "white",
      {
        declineToken: "decline-token",
        matchId: "match-1",
        password: "room-password",
        senderUsername: "black",
      },
      5000,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call).toBeDefined();

    const [url, init] = call!;

    expect(url).toBe("http://localhost:3001/internal/challenge-received");
    expect(init).toMatchObject({
      body: JSON.stringify({
        declineToken: "decline-token",
        matchId: "match-1",
        password: "room-password",
        senderUsername: "black",
        username: "white",
      }),
      cache: "no-store",
      method: "POST",
    });
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: "game-secret",
    });
  });
});
