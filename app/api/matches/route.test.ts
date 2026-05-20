import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { MatchStatus, MatchVisibility, Role, RuleType, Seat } from "@/../generated/prisma/enums";

const getCurrentSession = mock();
const createMatch = mock();
const findManyMatches = mock();
const cleanupExecuteRaw = mock();
const cleanupFindManyMatches = mock();
const cleanupUpdateManyMatches = mock();
const cleanupUpdateManyParticipants = mock();
const transaction = mock();
const fetchMock = mock();
const hashPassword = mock();
const verifyPassword = mock();
const originalFetch = globalThis.fetch;
const originalRealtimeInternalUrl = process.env["REALTIME_INTERNAL_URL"];
const originalRealtimeSecret = process.env["REALTIME_INTERNAL_SECRET"];

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    match: {
      create: createMatch,
      findMany: findManyMatches,
    },
  },
}));

await mock.module("better-auth/crypto", () => ({
  hashPassword,
  verifyPassword,
}));

const route = await import("./route");

const createdAt = new Date("2026-05-12T00:00:00.000Z");

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/matches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function creatorParticipant() {
  return {
    displayNameSnapshot: "Ada",
    id: "creator-1",
    joinedAt: createdAt,
    leftAt: null,
    matchId: "match-1",
    result: null,
    role: Role.PLAYER,
    seat: Seat.BLACK,
    userId: "user-ada",
  };
}

function createdMatch(overrides: Record<string, unknown> = {}) {
  return {
    boardSize: 15,
    createdAt,
    createdByUserId: "user-ada",
    endReason: null,
    finishedAt: null,
    id: "match-1",
    metadata: null,
    nextTurnSeat: null,
    participants: [creatorParticipant()],
    ruleType: RuleType.GOMOKU,
    startedAt: null,
    stateVersion: 0,
    status: MatchStatus.WAITING,
    updatedAt: createdAt,
    visibility: MatchVisibility.PUBLIC,
    winningSeat: null,
    ...overrides,
  };
}

beforeEach(() => {
  getCurrentSession.mockReset();
  createMatch.mockReset();
  findManyMatches.mockReset();
  cleanupExecuteRaw.mockReset();
  cleanupFindManyMatches.mockReset();
  cleanupUpdateManyMatches.mockReset();
  cleanupUpdateManyParticipants.mockReset();
  transaction.mockReset();
  fetchMock.mockReset();
  hashPassword.mockReset();
  verifyPassword.mockReset();

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env["REALTIME_INTERNAL_SECRET"] = "test-realtime-secret";
  process.env["REALTIME_INTERNAL_URL"] = "http://localhost/internal/game-update";

  getCurrentSession.mockResolvedValue({
    user: {
      displayName: "Ada",
      id: "user-ada",
      username: "ada",
    },
  });
  createMatch.mockResolvedValue(createdMatch());
  findManyMatches.mockResolvedValue([]);
  cleanupFindManyMatches.mockResolvedValue([]);
  cleanupUpdateManyMatches.mockResolvedValue({ count: 0 });
  cleanupUpdateManyParticipants.mockResolvedValue({ count: 0 });
  transaction.mockImplementation((callback: (transactionClient: unknown) => unknown) =>
    callback({
      $executeRaw: cleanupExecuteRaw,
      match: {
        findMany: cleanupFindManyMatches,
        updateMany: cleanupUpdateManyMatches,
      },
      matchParticipant: {
        updateMany: cleanupUpdateManyParticipants,
      },
    }),
  );
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  hashPassword.mockResolvedValue("hashed-room-password");
});

afterAll(() => {
  globalThis.fetch = originalFetch;
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

describe("GET /api/matches", () => {
  test("lists public and user-created private rooms without exposing challenge invites", async () => {
    findManyMatches.mockResolvedValueOnce([
      createdMatch({
        id: "public-match",
        name: "Open Study",
        password: null,
        visibility: MatchVisibility.PUBLIC,
      }),
      createdMatch({
        id: "private-match",
        name: "Study Room",
        password: "hashed-room-password",
        visibility: MatchVisibility.PRIVATE,
      }),
      createdMatch({
        id: "challenge-match",
        name: "Ada vs Bob",
        password: "hashed-challenge-password",
        metadata: {
          declineTokenHash: "hashed-decline-token",
          kind: "human-challenge",
          targetUserId: "user-bob",
          targetUsername: "bob",
        },
        visibility: MatchVisibility.PRIVATE,
      }),
    ]);

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findManyMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: MatchStatus.WAITING,
        },
      }),
    );
    expect(payload.data.map((match: { matchId: string }) => match.matchId)).toEqual([
      "public-match",
      "private-match",
    ]);
    expect(payload).toMatchObject({
      page: 1,
      limit: 10,
      totalMatches: 2,
      totalPages: 1,
    });
    expect(payload.data[1]).toMatchObject({
      matchId: "private-match",
      requiresPassword: true,
    });
  });

  test("paginates after filtering hidden challenge invites", async () => {
    findManyMatches.mockResolvedValueOnce([
      createdMatch({
        id: "listed-1",
        visibility: MatchVisibility.PUBLIC,
      }),
      createdMatch({
        id: "hidden-challenge",
        metadata: {
          declineTokenHash: "hashed-decline-token",
          kind: "human-challenge",
          targetUserId: "user-bob",
          targetUsername: "bob",
        },
        visibility: MatchVisibility.PRIVATE,
      }),
      createdMatch({
        id: "listed-2",
        visibility: MatchVisibility.PUBLIC,
      }),
      createdMatch({
        id: "listed-3",
        visibility: MatchVisibility.PUBLIC,
      }),
    ]);

    const response = await route.GET(new Request("http://localhost/api/matches?page=1&limit=2"));
    const payload = await response.json();
    const findManyArgs = findManyMatches.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect("skip" in findManyArgs).toBe(false);
    expect("take" in findManyArgs).toBe(false);
    expect(payload).toMatchObject({
      page: 1,
      limit: 2,
      totalMatches: 3,
      totalPages: 2,
    });
    expect(payload.data.map((match: { matchId: string }) => match.matchId)).toEqual([
      "listed-1",
      "listed-2",
    ]);
  });
});

describe("POST /api/matches", () => {
  test("creates public rooms without storing a supplied password", async () => {
    const response = await route.POST(
      request({
        name: "Open Study",
        password: "should-not-be-stored",
        visibility: MatchVisibility.PUBLIC,
      }),
    );

    expect(response.status).toBe(200);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Open Study",
          password: null,
          visibility: MatchVisibility.PUBLIC,
        }),
      }),
    );
  });

  test("requires a password before creating private rooms", async () => {
    const response = await route.POST(
      request({
        name: "Private Study",
        visibility: MatchVisibility.PRIVATE,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "private_room_password_required" });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(createMatch).not.toHaveBeenCalled();
  });

  test("hashes private room passwords before persistence", async () => {
    const response = await route.POST(
      request({
        name: "Private Study",
        password: "sente",
        visibility: MatchVisibility.PRIVATE,
      }),
    );

    expect(response.status).toBe(200);
    expect(hashPassword).toHaveBeenCalledWith("sente");
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Private Study",
          password: "hashed-room-password",
          visibility: MatchVisibility.PRIVATE,
        }),
      }),
    );
  });
});
