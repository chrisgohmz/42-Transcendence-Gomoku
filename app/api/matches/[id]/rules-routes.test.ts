import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "@/../generated/prisma/enums";
import { endReasonFiveInARow, endReasonResign } from "@/lib/matches/move-rules";

const transaction = mock();
const findMatch = mock();
const findMove = mock();
const createMove = mock();
const updateMatchMany = mock();
const updateParticipant = mock();
const publishGameUpdate = mock();
const publishChallengeReceived = mock();
const getCurrentSession = mock();

const tx = {
  match: {
    findUnique: findMatch,
    updateMany: updateMatchMany,
  },
  matchMove: {
    create: createMove,
    findUnique: findMove,
  },
  matchParticipant: {
    update: updateParticipant,
  },
};

await mock.module("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

await mock.module("@/lib/matches/realtime-publisher", () => ({
  publishChallengeReceived,
  publishGameUpdate,
}));

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

const movesRoute = await import("./moves/route");
const resignRoute = await import("./resign/route");

const createdAt = new Date("2026-05-10T00:00:00.000Z");
const startedAt = new Date("2026-05-10T00:01:00.000Z");

function context(matchId = "match-1") {
  return {
    params: Promise.resolve({ id: matchId }),
  };
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function participants() {
  return [
    {
      id: "black-player",
      matchId: "match-1",
      userId: "user-black",
      displayNameSnapshot: "Black",
      role: Role.PLAYER,
      seat: Seat.BLACK,
      result: null,
      joinedAt: startedAt,
      leftAt: null,
    },
    {
      id: "white-player",
      matchId: "match-1",
      userId: "user-white",
      displayNameSnapshot: "White",
      role: Role.PLAYER,
      seat: Seat.WHITE,
      result: null,
      joinedAt: startedAt,
      leftAt: null,
    },
  ];
}

function matchRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-1",
    status: MatchStatus.IN_PROGRESS,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    stateVersion: 8,
    nextTurnSeat: Seat.BLACK,
    winningSeat: null,
    endReason: null,
    createdByUserId: null,
    startedAt,
    finishedAt: null,
    createdAt,
    updatedAt: createdAt,
    participants: participants(),
    moves: [
      move("black-player", 1, 0, 7, 1),
      move("white-player", 2, 0, 8, 2),
      move("black-player", 3, 1, 7, 3),
      move("white-player", 4, 1, 8, 4),
      move("black-player", 5, 2, 7, 5),
      move("white-player", 6, 2, 8, 6),
      move("black-player", 7, 3, 7, 7),
      move("white-player", 8, 3, 8, 8),
    ],
    ...overrides,
  };
}

function move(
  participantId: string,
  moveNumber: number,
  x: number,
  y: number,
  stateVersion: number,
) {
  return {
    id: `move-${moveNumber}`,
    matchId: "match-1",
    participantId,
    moveNumber,
    x,
    y,
    requestId: null,
    baseVersion: stateVersion - 1,
    stateVersion,
    createdAt,
  };
}

beforeEach(() => {
  transaction.mockReset();
  findMatch.mockReset();
  findMove.mockReset();
  createMove.mockReset();
  updateMatchMany.mockReset();
  updateParticipant.mockReset();
  publishGameUpdate.mockReset();
  getCurrentSession.mockReset();

  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
  publishGameUpdate.mockResolvedValue(undefined);
  getCurrentSession.mockResolvedValue({
    user: {
      id: "user-black",
    },
  });
});

describe("POST /api/matches/:id/moves", () => {
  test("finishes the match when the submitted move completes five in a row", async () => {
    const storedMatch = matchRecord();
    const createdMove = move("black-player", 9, 4, 7, 9);

    findMatch.mockResolvedValueOnce(storedMatch);
    findMove.mockResolvedValueOnce(null);
    updateMatchMany.mockResolvedValueOnce({ count: 1 });
    createMove.mockResolvedValueOnce(createdMove);
    updateParticipant.mockResolvedValue({});

    const response = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: 4, y: 7 },
        baseVersion: 8,
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, accepted: true });
    expect(updateMatchMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: "match-1",
        status: MatchStatus.IN_PROGRESS,
        stateVersion: 8,
        nextTurnSeat: Seat.BLACK,
      },
      data: {
        status: MatchStatus.FINISHED,
        nextTurnSeat: null,
        winningSeat: Seat.BLACK,
        endReason: endReasonFiveInARow,
        stateVersion: 9,
      },
    });
    expect(updateParticipant.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: "black-player" }, data: { result: MatchResult.WIN } },
      { where: { id: "white-player" }, data: { result: MatchResult.LOSS } },
    ]);
    expect(publishGameUpdate.mock.calls[0]?.[0]).toMatchObject({
      matchId: "match-1",
      status: MatchStatus.FINISHED,
      winningSeat: Seat.BLACK,
      endReason: endReasonFiveInARow,
      nextTurnSeat: null,
      lastMove: {
        moveNumber: 9,
        position: { x: 4, y: 7 },
      },
    });
  });

  test("rejects a move when the match state changed before commit", async () => {
    const storedMatch = matchRecord();

    findMatch.mockResolvedValueOnce(storedMatch);
    findMove.mockResolvedValueOnce(null);
    updateMatchMany.mockResolvedValueOnce({ count: 0 });

    const response = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: 4, y: 7 },
        baseVersion: 8,
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: "stale_state" });
    expect(createMove).not.toHaveBeenCalled();
    expect(updateParticipant).not.toHaveBeenCalled();
    expect(publishGameUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/matches/:id/resign", () => {
  test("finishes the match in favor of the opponent", async () => {
    const storedMatch = matchRecord();

    findMatch.mockResolvedValueOnce(storedMatch);
    updateMatchMany.mockResolvedValueOnce({ count: 1 });
    updateParticipant.mockResolvedValue({});

    const response = await resignRoute.POST(
      jsonRequest("/api/matches/match-1/resign", {
        participantId: "black-player",
        baseVersion: 8,
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      accepted: true,
      stateVersion: 9,
      winningSeat: Seat.WHITE,
      endReason: endReasonResign,
    });
    expect(updateMatchMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: "match-1",
        status: MatchStatus.IN_PROGRESS,
        stateVersion: 8,
      },
      data: {
        status: MatchStatus.FINISHED,
        nextTurnSeat: null,
        winningSeat: Seat.WHITE,
        endReason: endReasonResign,
        stateVersion: 9,
      },
    });
    expect(updateParticipant.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: "black-player" }, data: { result: MatchResult.LOSS } },
      { where: { id: "white-player" }, data: { result: MatchResult.WIN } },
    ]);
    expect(publishGameUpdate.mock.calls[0]?.[0]).toMatchObject({
      matchId: "match-1",
      status: MatchStatus.FINISHED,
      winningSeat: Seat.WHITE,
      endReason: endReasonResign,
      nextTurnSeat: null,
    });
  });

  test("rejects resignation when the match state changed before commit", async () => {
    const storedMatch = matchRecord();

    findMatch.mockResolvedValueOnce(storedMatch);
    updateMatchMany.mockResolvedValueOnce({ count: 0 });

    const response = await resignRoute.POST(
      jsonRequest("/api/matches/match-1/resign", {
        participantId: "black-player",
        baseVersion: 8,
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: "stale_state" });
    expect(updateParticipant).not.toHaveBeenCalled();
    expect(publishGameUpdate).not.toHaveBeenCalled();
  });
});
