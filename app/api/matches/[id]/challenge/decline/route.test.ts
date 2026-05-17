import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "@/../generated/prisma/enums";

const getCurrentSession = mock();
const findMatch = mock();
const transaction = mock();
const updateMatch = mock();
const updateManyParticipants = mock();
const fetchMock = mock();
const hashPassword = mock();
const verifyPassword = mock();
const originalChallengeDeclinedUrl = process.env["REALTIME_CHALLENGE_DECLINED_URL"];
const originalFetch = globalThis.fetch;
const originalRealtimeInternalUrl = process.env["REALTIME_INTERNAL_URL"];
const originalRealtimeSecret = process.env["REALTIME_INTERNAL_SECRET"];

const tx = {
  match: {
    update: updateMatch,
  },
  matchParticipant: {
    updateMany: updateManyParticipants,
  },
};

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    match: {
      findUnique: findMatch,
    },
  },
}));

await mock.module("better-auth/crypto", () => ({
  hashPassword,
  verifyPassword,
}));

const route = await import("./route");

const createdAt = new Date("2026-05-12T00:00:00.000Z");

function request(body: Record<string, unknown> = { declineToken: "decline-token" }) {
  return new Request("http://localhost/api/matches/match-1/challenge/decline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function context(matchId = "match-1") {
  return {
    params: Promise.resolve({ id: matchId }),
  };
}

function getFetchBody(callIndex: number) {
  const call = fetchMock.mock.calls[callIndex];
  expect(call).toBeDefined();
  const init = call?.[1] as RequestInit;

  return JSON.parse(init.body as string);
}

function challengeMatch() {
  return {
    boardSize: 15,
    createdAt,
    createdByUserId: "user-black",
    endReason: null,
    finishedAt: null,
    id: "match-1",
    metadata: {
      declineTokenHash: "hashed-decline-token",
      kind: "human-challenge",
      targetUserId: "user-white",
      targetUsername: "white",
    },
    nextTurnSeat: null,
    participants: [
      {
        displayNameSnapshot: "Black",
        id: "black-player",
        joinedAt: createdAt,
        leftAt: null,
        matchId: "match-1",
        result: null,
        role: Role.PLAYER,
        seat: Seat.BLACK,
        user: {
          username: "black",
        },
        userId: "user-black",
      },
    ],
    password: "hashed-room-password",
    ruleType: RuleType.GOMOKU,
    startedAt: null,
    stateVersion: 0,
    status: MatchStatus.WAITING,
    updatedAt: createdAt,
    visibility: MatchVisibility.PRIVATE,
    winningSeat: null,
  };
}

beforeEach(() => {
  getCurrentSession.mockReset();
  findMatch.mockReset();
  transaction.mockReset();
  updateMatch.mockReset();
  updateManyParticipants.mockReset();
  fetchMock.mockReset();
  hashPassword.mockReset();
  verifyPassword.mockReset();

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env["REALTIME_CHALLENGE_DECLINED_URL"] = "http://localhost/internal/challenge-declined";
  process.env["REALTIME_INTERNAL_SECRET"] = "test-realtime-secret";
  process.env["REALTIME_INTERNAL_URL"] = "http://localhost/internal/game-update";

  getCurrentSession.mockResolvedValue({
    user: {
      displayName: "White",
      id: "user-white",
      username: "white",
    },
  });
  findMatch.mockResolvedValue(challengeMatch());
  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
  updateMatch.mockResolvedValue({});
  updateManyParticipants.mockResolvedValue({ count: 1 });
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  verifyPassword.mockResolvedValue(true);
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalChallengeDeclinedUrl === undefined) {
    delete process.env["REALTIME_CHALLENGE_DECLINED_URL"];
  } else {
    process.env["REALTIME_CHALLENGE_DECLINED_URL"] = originalChallengeDeclinedUrl;
  }
  if (originalRealtimeInternalUrl === undefined) {
    delete process.env["REALTIME_INTERNAL_URL"];
  } else {
    process.env["REALTIME_INTERNAL_URL"] = originalRealtimeInternalUrl;
  }
  if (originalRealtimeSecret === undefined) {
    delete process.env["REALTIME_INTERNAL_SECRET"];
  } else {
    process.env["REALTIME_INTERNAL_SECRET"] = originalRealtimeSecret;
  }
});

describe("POST /api/matches/:id/challenge/decline", () => {
  test("requires authentication before declining a challenge", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.POST(request(), context());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: "unauthorized" });
    expect(findMatch).not.toHaveBeenCalled();
  });

  test("does not cancel or notify when decline token verification fails", async () => {
    verifyPassword.mockResolvedValueOnce(false);

    const response = await route.POST(request({ declineToken: "wrong" }), context());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ error: "challenge_not_cancellable" });
    expect(verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-decline-token",
      password: "wrong",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not let a private room password cancel a non-challenge room", async () => {
    findMatch.mockResolvedValueOnce({
      ...challengeMatch(),
      metadata: null,
    });

    const response = await route.POST(request({ declineToken: "sente" }), context());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ error: "challenge_not_cancellable" });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not let a user decline someone else's challenge invite", async () => {
    getCurrentSession.mockResolvedValueOnce({
      user: {
        displayName: "Red",
        id: "user-red",
        username: "red",
      },
    });

    const response = await route.POST(request(), context());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ error: "challenge_not_cancellable" });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("cancels the challenge before publishing a server-derived decline notification", async () => {
    const response = await route.POST(request({ declineToken: "decline-token" }), context());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      matchId: "match-1",
      status: MatchStatus.CANCELLED,
    });
    expect(updateMatch).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endReason: "challenge_declined",
        finishedAt: expect.any(Date),
        nextTurnSeat: null,
        status: MatchStatus.CANCELLED,
      }),
      where: { id: "match-1" },
    });
    expect(updateManyParticipants).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leftAt: expect.any(Date),
        result: MatchResult.CANCELLED,
      }),
      where: {
        leftAt: null,
        matchId: "match-1",
        result: null,
      },
    });
    expect(verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-decline-token",
      password: "decline-token",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchBody(0)).toEqual({
      matchId: "match-1",
      senderUsername: "white",
      username: "black",
    });
  });
});
