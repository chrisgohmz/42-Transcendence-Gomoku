import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { GameUpdatePayload } from "../../../shared/match-events";
import { internalRealtimeSecretHeader } from "../../../shared/realtime-internal";
import { realtimeOutboxStatuses, realtimeOutboxTopics } from "../realtime-outbox-contract";
import type { RealtimeOutboxEvent, RealtimeOutboxPrisma } from "../realtime-outbox-core";
import {
  drainMatchRealtimeOutbox,
  publishChallengeDeclined,
  publishChallengeReceived,
  publishGameUpdate,
  publishQueueMatched,
  publishRealtimeOutboxEvent,
  resolveChallengeDeclinedUrl,
  resolveChallengeReceivedUrl,
  resolveGameUpdateUrl,
  resolveQueueMatchedUrl,
} from "./realtime-publisher";

const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalFetch = globalThis.fetch;
const envKeys = [
  "BETTER_AUTH_SECRET",
  "REALTIME_CHALLENGE_DECLINED_URL",
  "REALTIME_CHALLENGE_RECEIVED_URL",
  "REALTIME_INTERNAL_SECRET",
  "REALTIME_INTERNAL_URL",
  "REALTIME_QUEUE_MATCHED_URL",
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

describe("queue and challenge endpoint resolution", () => {
  test("uses explicit queue and challenge-declined endpoints when configured", () => {
    process.env["REALTIME_QUEUE_MATCHED_URL"] = "http://realtime/internal/custom-queue";
    process.env["REALTIME_CHALLENGE_DECLINED_URL"] =
      "http://realtime/internal/custom-challenge-declined";

    expect(resolveQueueMatchedUrl()).toBe("http://realtime/internal/custom-queue");
    expect(resolveChallengeDeclinedUrl()).toBe(
      "http://realtime/internal/custom-challenge-declined",
    );
  });

  test("derives the challenge-declined endpoint from the game endpoint", () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";

    expect(resolveChallengeDeclinedUrl()).toBe("http://localhost:3001/internal/challenge-declined");
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

  test("persists failed game updates to an injected outbox when enabled", async () => {
    process.env["REALTIME_INTERNAL_SECRET"] = "game-secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const enqueueOutboxEvent = mock(async (_event: unknown) => {});

    await expectRejectsWithMessage(
      () => publishGameUpdate(payload, 5000, { enqueueOutboxEvent, persistOnFailure: true }),
      "Failed to publish game:update(503)",
    );

    const call = enqueueOutboxEvent.mock.calls[0]?.[0];

    expect(enqueueOutboxEvent).toHaveBeenCalledTimes(1);
    expect(call).toMatchObject({
      payload,
      topic: realtimeOutboxTopics.gameUpdate,
    });
    expect((call as { error?: unknown } | undefined)?.error).toBeInstanceOf(Error);
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

describe("publishQueueMatched", () => {
  test("posts the matched session to a localhost-derived queue endpoint", async () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";
    process.env["REALTIME_QUEUE_MATCHED_URL"] = "http://realtime:3001/internal/queue-matched";
    process.env["REALTIME_INTERNAL_SECRET"] = "queue-secret";

    await publishQueueMatched(
      "black",
      {
        matchId: "match-1",
        participantId: "black-player",
      },
      5000,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call?.[0]).toBe("http://localhost:3001/internal/queue-matched");
    expect(call?.[1]).toMatchObject({
      body: JSON.stringify({
        username: "black",
        session: {
          matchId: "match-1",
          participantId: "black-player",
        },
      }),
      cache: "no-store",
      method: "POST",
    });
    expect(call?.[1].headers).toEqual({
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: "queue-secret",
    });
  });

  test("throws on missing secrets and failed queue responses", async () => {
    await expectRejectsWithMessage(
      () => publishQueueMatched("black", { matchId: "match-1" }),
      "Missing REALTIME_INTERNAL_SECRET",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    process.env["REALTIME_INTERNAL_SECRET"] = "queue-secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 502 }));

    await expectRejectsWithMessage(
      () => publishQueueMatched("black", { matchId: "match-1" }),
      "Failed to publish queue:matched (502)",
    );
  });
});

describe("publishRealtimeOutboxEvent", () => {
  test("replays queue match events through the internal queue endpoint", async () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";
    process.env["REALTIME_INTERNAL_SECRET"] = "queue-secret";

    await publishRealtimeOutboxEvent(
      {
        id: "evt-1",
        payload: {
          session: { matchId: "match-1" },
          username: "black",
        },
        topic: realtimeOutboxTopics.queueMatched,
      },
      5000,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call?.[0]).toBe("http://localhost:3001/internal/queue-matched");
    expect(call?.[1]).toMatchObject({
      body: JSON.stringify({
        username: "black",
        session: { matchId: "match-1" },
      }),
      cache: "no-store",
      method: "POST",
    });
  });
});

describe("drainMatchRealtimeOutbox", () => {
  test("uses the standalone outbox core for non-Next workers", async () => {
    process.env["REALTIME_INTERNAL_URL"] = "http://localhost:3001/internal/game-update";
    process.env["REALTIME_INTERNAL_SECRET"] = "outbox-secret";
    const now = new Date("2026-05-29T01:00:00.000Z");
    const event: RealtimeOutboxEvent = {
      attempts: 0,
      availableAt: now,
      createdAt: now,
      id: "evt-1",
      lastError: null,
      lockedAt: null,
      maxAttempts: 5,
      payload: payload as unknown as RealtimeOutboxEvent["payload"],
      publishedAt: null,
      status: realtimeOutboxStatuses.pending,
      topic: realtimeOutboxTopics.gameUpdate,
      updatedAt: now,
    };
    const prisma: RealtimeOutboxPrisma = {
      realtimeOutboxEvent: {
        async create() {
          return {};
        },
        async findMany() {
          return [event];
        },
        async update() {
          return {};
        },
        async updateMany() {
          return { count: 1 };
        },
      },
    };

    const summary = await drainMatchRealtimeOutbox({ now, prisma });

    expect(summary).toEqual({ failed: 0, published: 1, retried: 0, skipped: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call?.[0]).toBe("http://localhost:3001/internal/game-update");
  });
});

describe("publishChallengeDeclined", () => {
  test("posts a decline notification with the username envelope", async () => {
    process.env["REALTIME_CHALLENGE_DECLINED_URL"] =
      "http://localhost:3001/internal/challenge-declined";
    process.env["REALTIME_INTERNAL_SECRET"] = "decline-secret";

    await publishChallengeDeclined(
      "black",
      {
        matchId: "match-1",
        senderUsername: "white",
      },
      5000,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call?.[0]).toBe("http://localhost:3001/internal/challenge-declined");
    expect(call?.[1]).toMatchObject({
      body: JSON.stringify({
        matchId: "match-1",
        senderUsername: "white",
        username: "black",
      }),
      cache: "no-store",
      method: "POST",
    });
    expect(call?.[1].headers).toEqual({
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: "decline-secret",
    });
  });

  test("throws on failed challenge-declined responses", async () => {
    process.env["REALTIME_INTERNAL_SECRET"] = "decline-secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expectRejectsWithMessage(
      () =>
        publishChallengeDeclined("black", {
          matchId: "match-1",
          senderUsername: "white",
        }),
      "Failed to publish challenge:declined (503)",
    );
  });
});
