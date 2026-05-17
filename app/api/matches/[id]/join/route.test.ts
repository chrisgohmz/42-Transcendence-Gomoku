import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { MatchStatus, MatchVisibility, Role, RuleType, Seat } from "@/../generated/prisma/enums";

const getCurrentSession = mock();
const findMatch = mock();
const transaction = mock();
const createParticipant = mock();
const updateMatch = mock();
const fetchMock = mock();
const hashPassword = mock();
const verifyPassword = mock();
const originalFetch = globalThis.fetch;
const originalQueueMatchedUrl = process.env["REALTIME_QUEUE_MATCHED_URL"];
const originalRealtimeInternalUrl = process.env["REALTIME_INTERNAL_URL"];
const originalRealtimeSecret = process.env["REALTIME_INTERNAL_SECRET"];

const tx = {
  match: {
    update: updateMatch,
  },
  matchParticipant: {
    create: createParticipant,
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
const startedAt = new Date("2026-05-12T00:01:00.000Z");

function request(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/matches/match-1/join", {
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

function hostParticipant() {
  return {
    displayNameSnapshot: "Black",
    id: "black-player",
    joinedAt: createdAt,
    leftAt: null,
    matchId: "match-1",
    result: null,
    role: Role.PLAYER,
    seat: Seat.BLACK,
    userId: "user-black",
  };
}

function joinerParticipant() {
  return {
    displayNameSnapshot: "White",
    id: "white-player",
    joinedAt: startedAt,
    leftAt: null,
    matchId: "match-1",
    result: null,
    role: Role.PLAYER,
    seat: Seat.WHITE,
    userId: "user-white",
  };
}

function waitingMatch() {
  return {
    boardSize: 15,
    createdAt,
    createdByUserId: "user-black",
    endReason: null,
    finishedAt: null,
    id: "match-1",
    metadata: null,
    nextTurnSeat: null,
    password: null,
    participants: [hostParticipant()],
    ruleType: RuleType.GOMOKU,
    startedAt: null,
    stateVersion: 0,
    status: MatchStatus.WAITING,
    updatedAt: createdAt,
    visibility: MatchVisibility.PUBLIC,
    winningSeat: null,
  };
}

function updatedMatch() {
  return {
    ...waitingMatch(),
    moves: [],
    nextTurnSeat: Seat.BLACK,
    participants: [
      {
        ...hostParticipant(),
        user: {
          username: "black",
        },
      },
      {
        ...joinerParticipant(),
        user: {
          username: "white",
        },
      },
    ],
    startedAt,
    stateVersion: 1,
    status: MatchStatus.IN_PROGRESS,
  };
}

beforeEach(() => {
  getCurrentSession.mockReset();
  findMatch.mockReset();
  transaction.mockReset();
  createParticipant.mockReset();
  updateMatch.mockReset();
  fetchMock.mockReset();
  hashPassword.mockReset();
  verifyPassword.mockReset();

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env["REALTIME_INTERNAL_SECRET"] = "test-realtime-secret";
  process.env["REALTIME_INTERNAL_URL"] = "http://localhost/internal/game-update";
  process.env["REALTIME_QUEUE_MATCHED_URL"] = "http://localhost/internal/queue-matched";

  getCurrentSession.mockResolvedValue({
    user: {
      displayName: "White",
      id: "user-white",
      username: "white",
    },
  });
  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
  createParticipant.mockResolvedValue(joinerParticipant());
  updateMatch.mockResolvedValue(updatedMatch());
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  verifyPassword.mockResolvedValue(true);
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalQueueMatchedUrl === undefined) {
    delete process.env["REALTIME_QUEUE_MATCHED_URL"];
  } else {
    process.env["REALTIME_QUEUE_MATCHED_URL"] = originalQueueMatchedUrl;
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

describe("POST /api/matches/:id/join", () => {
  test("requires authentication before joining", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.POST(request(), context());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: "unauthorized" });
    expect(findMatch).not.toHaveBeenCalled();
  });

  test("starts the match, increments state version, and publishes the update", async () => {
    findMatch.mockResolvedValueOnce(waitingMatch());

    const response = await route.POST(request(), context());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      displayName: "White",
      matchId: "match-1",
      participantId: "white-player",
      role: Role.PLAYER,
      seat: Seat.WHITE,
      stateVersion: 1,
    });
    expect(updateMatch).toHaveBeenCalledWith({
      data: {
        nextTurnSeat: Seat.BLACK,
        startedAt: expect.any(Date),
        stateVersion: {
          increment: 1,
        },
        status: MatchStatus.IN_PROGRESS,
      },
      include: {
        moves: {
          orderBy: { moveNumber: "asc" },
        },
        participants: {
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
      where: { id: "match-1" },
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  test("verifies a private match password before starting the match", async () => {
    findMatch.mockResolvedValueOnce({
      ...waitingMatch(),
      password: "hashed-room-password",
      visibility: MatchVisibility.PRIVATE,
    });

    const response = await route.POST(request({ password: "sente" }), context());

    expect(response.status).toBe(200);
    expect(verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-room-password",
      password: "sente",
    });
    expect(createParticipant).toHaveBeenCalled();
  });

  test("rejects a private match when password verification fails", async () => {
    findMatch.mockResolvedValueOnce({
      ...waitingMatch(),
      password: "hashed-room-password",
      visibility: MatchVisibility.PRIVATE,
    });
    verifyPassword.mockResolvedValueOnce(false);

    const response = await route.POST(request({ password: "wrong" }), context());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: "invalid_password" });
    expect(verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-room-password",
      password: "wrong",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects challenge rooms when the signed-in user is not the invitee", async () => {
    findMatch.mockResolvedValueOnce({
      ...waitingMatch(),
      metadata: {
        declineTokenHash: "hashed-decline-token",
        kind: "human-challenge",
        targetUserId: "user-red",
        targetUsername: "red",
      },
      password: "hashed-room-password",
      visibility: MatchVisibility.PRIVATE,
    });

    const response = await route.POST(request({ password: "sente" }), context());
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: "challenge_not_for_user" });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
