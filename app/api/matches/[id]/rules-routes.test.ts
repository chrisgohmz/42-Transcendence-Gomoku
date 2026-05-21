import { beforeEach, describe, expect, mock, test } from "bun:test";

import { Prisma } from "@/../generated/prisma/client";
import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "@/../generated/prisma/enums";
import { endReasonFiveInARow, endReasonResign } from "@/lib/matches/move-rules";
import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const transaction = mock();
const findMatch = mock();
const findMove = mock();
const createMove = mock();
const updateMatchMany = mock();
const updateParticipant = mock();
const updateManyParticipants = mock();
const publishGameUpdate = mock();
const publishChallengeDeclined = mock();
const publishChallengeReceived = mock();
const publishQueueMatched = mock();
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
    updateMany: updateManyParticipants,
  },
};

await mock.module("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

await mock.module("@/lib/matches/realtime-publisher", () => ({
  publishChallengeDeclined,
  publishChallengeReceived,
  publishGameUpdate,
  publishQueueMatched,
}));

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

const movesRoute = await import("./moves/route");
const resignRoute = await import("./resign/route");
const cancelRoute = await import("./cancel/route");

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
  updateManyParticipants.mockReset();
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
  test("requires authentication before validating move payloads", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: 4, y: 7 },
      }),
      context(),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(transaction).not.toHaveBeenCalled();
  });

  test("rejects malformed move payloads before opening a transaction", async () => {
    const response = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: -1, y: 7 },
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_payload" });
    expect(transaction).not.toHaveBeenCalled();
  });

  test("reports missing matches and unauthorized participants without writing moves", async () => {
    findMatch.mockResolvedValueOnce(null);

    const missingResponse = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: 4, y: 7 },
        baseVersion: 8,
      }),
      context(),
    );

    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({ error: "match_not_found" });

    findMatch.mockResolvedValueOnce(matchRecord());

    const forbiddenResponse = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "white-player",
        position: { x: 4, y: 7 },
        baseVersion: 8,
      }),
      context(),
    );

    expect(forbiddenResponse.status).toBe(403);
    expect(await forbiddenResponse.json()).toEqual({ error: "participant_not_found" });
    expect(createMove).not.toHaveBeenCalled();
    expect(publishGameUpdate).not.toHaveBeenCalled();
  });

  test("rejects occupied intersections before creating another move", async () => {
    findMatch.mockResolvedValueOnce(matchRecord());
    findMove.mockResolvedValueOnce({ id: "occupied-cell" });

    const response = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: 4, y: 7 },
        baseVersion: 8,
      }),
      context(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "occupied" });
    expect(createMove).not.toHaveBeenCalled();
    expect(updateParticipant).not.toHaveBeenCalled();
  });

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

  test("keeps an accepted move successful when realtime publishing fails", async () => {
    const storedMatch = matchRecord({
      moves: [],
      stateVersion: 0,
    });
    const createdMove = { ...move("black-player", 1, 7, 7, 1), requestId: "move-1" };

    findMatch.mockResolvedValueOnce(storedMatch);
    findMove.mockResolvedValueOnce(null);
    updateMatchMany.mockResolvedValueOnce({ count: 1 });
    createMove.mockResolvedValueOnce(createdMove);
    publishGameUpdate.mockRejectedValueOnce(new Error("realtime down"));

    const response = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: 7, y: 7 },
        baseVersion: 0,
        requestId: "move-1",
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      accepted: true,
      ok: true,
      requestId: "move-1",
    });
    expect(createMove).toHaveBeenCalled();
  });

  test("maps Prisma unique constraint conflicts to public move errors", async () => {
    transaction.mockRejectedValueOnce(prismaKnownRequestError("P2002", { target: ["requestId"] }));

    const response = await movesRoute.POST(
      jsonRequest("/api/matches/match-1/moves", {
        participantId: "black-player",
        position: { x: 4, y: 7 },
        baseVersion: 8,
        requestId: "duplicate-request",
      }),
      context(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "duplicate_request",
    });
  });
});

describe("POST /api/matches/:id/resign", () => {
  test("requires authentication and valid payloads before resigning", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const unauthorizedResponse = await resignRoute.POST(
      jsonRequest("/api/matches/match-1/resign", {
        participantId: "black-player",
      }),
      context(),
    );

    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({ error: "unauthorized" });

    const invalidResponse = await resignRoute.POST(
      jsonRequest("/api/matches/match-1/resign", {
        participantId: "",
      }),
      context(),
    );

    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toEqual({ error: "invalid_payload" });
    expect(transaction).not.toHaveBeenCalled();
  });

  test("reports missing matches and unauthorized participants before resigning", async () => {
    findMatch.mockResolvedValueOnce(null);

    const missingResponse = await resignRoute.POST(
      jsonRequest("/api/matches/match-1/resign", {
        participantId: "black-player",
      }),
      context(),
    );

    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({ error: "match_not_found" });

    findMatch.mockResolvedValueOnce(matchRecord());

    const forbiddenResponse = await resignRoute.POST(
      jsonRequest("/api/matches/match-1/resign", {
        participantId: "white-player",
      }),
      context(),
    );

    expect(forbiddenResponse.status).toBe(403);
    expect(await forbiddenResponse.json()).toEqual({ error: "participant_not_found" });
    expect(updateParticipant).not.toHaveBeenCalled();
  });

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

describe("POST /api/matches/:id/cancel", () => {
  test("requires authentication and valid payloads before cancelling", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const unauthorizedResponse = await cancelRoute.POST(
      jsonRequest("/api/matches/match-1/cancel", {
        participantId: "black-player",
      }),
      context(),
    );

    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({ error: "unauthorized" });

    const invalidResponse = await cancelRoute.POST(
      jsonRequest("/api/matches/match-1/cancel", {
        participantId: "",
      }),
      context(),
    );

    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toEqual({ error: "invalid_payload" });
    expect(transaction).not.toHaveBeenCalled();
  });

  test("allows only the waiting-room host to cancel", async () => {
    findMatch.mockResolvedValueOnce(
      matchRecord({
        createdByUserId: "user-white",
        moves: [],
        nextTurnSeat: null,
        participants: [participants()[0]],
        stateVersion: 0,
        status: MatchStatus.WAITING,
      }),
    );

    const response = await cancelRoute.POST(
      jsonRequest("/api/matches/match-1/cancel", {
        participantId: "black-player",
        baseVersion: 0,
      }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "only_host_can_cancel" });
    expect(updateMatchMany).not.toHaveBeenCalled();
    expect(updateManyParticipants).not.toHaveBeenCalled();
  });

  test("cancels a waiting room for the host before returning to the lobby", async () => {
    const storedMatch = matchRecord({
      createdByUserId: "user-black",
      moves: [],
      nextTurnSeat: null,
      participants: [participants()[0]],
      stateVersion: 0,
      status: MatchStatus.WAITING,
    });

    findMatch.mockResolvedValueOnce(storedMatch);
    updateMatchMany.mockResolvedValueOnce({ count: 1 });
    updateManyParticipants.mockResolvedValueOnce({ count: 1 });

    const response = await cancelRoute.POST(
      jsonRequest("/api/matches/match-1/cancel", {
        participantId: "black-player",
        baseVersion: 0,
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      accepted: true,
      endReason: "host_cancelled",
      ok: true,
      stateVersion: 1,
    });
    expect(updateMatchMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: "match-1",
        stateVersion: 0,
        status: MatchStatus.WAITING,
      },
      data: {
        endReason: "host_cancelled",
        nextTurnSeat: null,
        stateVersion: 1,
        status: MatchStatus.CANCELLED,
        winningSeat: null,
      },
    });
    expect(updateManyParticipants.mock.calls[0]?.[0]).toMatchObject({
      where: {
        leftAt: null,
        matchId: "match-1",
        result: null,
      },
      data: {
        leftAt: expect.any(Date),
        result: MatchResult.CANCELLED,
      },
    });
    expect(publishGameUpdate.mock.calls[0]?.[0]).toMatchObject({
      endReason: "host_cancelled",
      matchId: "match-1",
      status: MatchStatus.CANCELLED,
    });
  });

  test("rejects waiting-room cancellation when the match already advanced", async () => {
    const storedMatch = matchRecord({
      createdByUserId: "user-black",
      moves: [],
      nextTurnSeat: null,
      participants: [participants()[0]],
      stateVersion: 1,
      status: MatchStatus.WAITING,
    });

    findMatch.mockResolvedValueOnce(storedMatch);

    const response = await cancelRoute.POST(
      jsonRequest("/api/matches/match-1/cancel", {
        participantId: "black-player",
        baseVersion: 0,
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: "stale_state" });
    expect(updateMatchMany).not.toHaveBeenCalled();
    expect(updateManyParticipants).not.toHaveBeenCalled();
    expect(publishGameUpdate).not.toHaveBeenCalled();
  });
});

function prismaKnownRequestError(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("Prisma known request error", {
    clientVersion: "test",
    code,
    meta,
  });
}
