import { beforeEach, describe, expect, mock, test } from "bun:test";

import { MatchStatus, MatchVisibility, Role, RuleType, Seat } from "@/../generated/prisma/enums";

const getCurrentSession = mock();
const findMatch = mock();
const transaction = mock();
const createParticipant = mock();
const updateMatch = mock();
const publishGameUpdate = mock();

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

await mock.module("@/lib/matches/realtime-publisher", () => ({
  publishGameUpdate,
}));

const route = await import("./route");

const createdAt = new Date("2026-05-12T00:00:00.000Z");
const startedAt = new Date("2026-05-12T00:01:00.000Z");

function request() {
  return new Request("http://localhost/api/matches/match-1/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
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
    nextTurnSeat: null,
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
    participants: [hostParticipant(), joinerParticipant()],
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
  publishGameUpdate.mockReset();

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
  publishGameUpdate.mockResolvedValue(undefined);
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
      matchId: "match-1",
      participantId: "white-player",
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
          orderBy: { joinedAt: "asc" },
        },
      },
      where: { id: "match-1" },
    });
    expect(publishGameUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "match-1",
        moves: [],
        nextTurnSeat: Seat.BLACK,
        participants: [
          expect.objectContaining({ participantId: "black-player", seat: Seat.BLACK }),
          expect.objectContaining({ participantId: "white-player", seat: Seat.WHITE }),
        ],
        stateVersion: 1,
        status: MatchStatus.IN_PROGRESS,
      }),
      2000,
    );
  });
});
