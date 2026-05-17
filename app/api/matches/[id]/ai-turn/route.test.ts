import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "@/../generated/prisma/enums";
import { soloAiDisplayName } from "@/lib/matches/ai-solo";
import { endReasonFiveInARow } from "@/lib/matches/move-rules";

const getCurrentSession = mock();
const previewFindMatch = mock();
const transaction = mock();
const findMatch = mock();
const updateMatchMany = mock();
const createMove = mock();
const updateParticipant = mock();
const publishGameUpdate = mock();
const publishChallengeReceived = mock();
const chooseAiMove = mock();

const tx = {
  match: {
    findUnique: findMatch,
    updateMany: updateMatchMany,
  },
  matchMove: {
    create: createMove,
  },
  matchParticipant: {
    update: updateParticipant,
  },
};

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    match: {
      findUnique: previewFindMatch,
    },
  },
}));

await mock.module("@/lib/matches/realtime-publisher", () => ({
  publishChallengeReceived,
  publishGameUpdate,
}));

await mock.module("@/lib/matches/ai-engine", () => ({
  chooseAiMove,
}));

const route = await import("./route");
const originalAiResponseDelayMs = process.env["AI_RESPONSE_DELAY_MS"];

const createdAt = new Date("2026-05-16T00:00:00.000Z");
const startedAt = new Date("2026-05-16T00:01:00.000Z");

function context(matchId = "solo-match") {
  return {
    params: Promise.resolve({ id: matchId }),
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/matches/solo-match/ai-turn", {
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
      displayNameSnapshot: "Human",
      id: "human-player",
      joinedAt: startedAt,
      leftAt: null,
      matchId: "solo-match",
      result: null,
      role: Role.PLAYER,
      seat: Seat.BLACK,
      userId: "human-user",
    },
    {
      displayNameSnapshot: soloAiDisplayName,
      id: "ai-player",
      joinedAt: startedAt,
      leftAt: null,
      matchId: "solo-match",
      result: null,
      role: Role.PLAYER,
      seat: Seat.WHITE,
      userId: null,
    },
  ];
}

function move(
  participantId: string,
  moveNumber: number,
  x: number,
  y: number,
  stateVersion: number,
) {
  return {
    baseVersion: stateVersion - 1,
    createdAt,
    id: `move-${moveNumber}`,
    matchId: "solo-match",
    moveNumber,
    participantId,
    requestId: null,
    stateVersion,
    x,
    y,
  };
}

function matchRecord(overrides: Record<string, unknown> = {}) {
  return {
    boardSize: 15,
    createdAt,
    createdByUserId: "human-user",
    endReason: null,
    finishedAt: null,
    id: "solo-match",
    metadata: {
      aiDifficulty: "master",
      mode: "ai",
    },
    moves: [
      move("human-player", 1, 0, 0, 1),
      move("ai-player", 2, 1, 7, 2),
      move("human-player", 3, 0, 1, 3),
      move("ai-player", 4, 2, 7, 4),
      move("human-player", 5, 0, 2, 5),
      move("ai-player", 6, 3, 7, 6),
      move("human-player", 7, 0, 3, 7),
      move("ai-player", 8, 4, 7, 8),
      move("human-player", 9, 10, 10, 9),
    ],
    nextTurnSeat: Seat.WHITE,
    participants: participants(),
    ruleType: RuleType.GOMOKU,
    startedAt,
    stateVersion: 9,
    status: MatchStatus.IN_PROGRESS,
    updatedAt: createdAt,
    visibility: MatchVisibility.PRIVATE,
    winningSeat: null,
    ...overrides,
  };
}

beforeEach(() => {
  process.env["AI_RESPONSE_DELAY_MS"] = "0";
  getCurrentSession.mockReset();
  previewFindMatch.mockReset();
  transaction.mockReset();
  findMatch.mockReset();
  updateMatchMany.mockReset();
  createMove.mockReset();
  updateParticipant.mockReset();
  publishGameUpdate.mockReset();
  chooseAiMove.mockReset();

  getCurrentSession.mockResolvedValue({
    user: {
      id: "human-user",
    },
  });
  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
  publishGameUpdate.mockResolvedValue(undefined);
  chooseAiMove.mockReturnValue({
    position: { x: 5, y: 7 },
    reason: "finishes the row",
    score: 100_000,
  });
});

afterAll(() => {
  if (typeof originalAiResponseDelayMs === "string") {
    process.env["AI_RESPONSE_DELAY_MS"] = originalAiResponseDelayMs;
    return;
  }

  delete process.env["AI_RESPONSE_DELAY_MS"];
});

describe("POST /api/matches/:id/ai-turn", () => {
  test("plays a structured-metadata AI turn and records finished results", async () => {
    const storedMatch = matchRecord();
    const createdMove = move("ai-player", 10, 5, 7, 10);

    previewFindMatch.mockResolvedValueOnce(storedMatch);
    findMatch.mockResolvedValueOnce(storedMatch);
    updateMatchMany.mockResolvedValueOnce({ count: 1 });
    createMove.mockResolvedValueOnce(createdMove);
    updateParticipant.mockResolvedValue({});

    const response = await route.POST(
      request({
        baseVersion: 9,
        participantId: "human-player",
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      accepted: true,
      ok: true,
      stateVersion: 10,
    });
    expect(chooseAiMove.mock.calls[0]?.[0]).toMatchObject({
      aiParticipantId: "ai-player",
      difficultyId: "master",
    });
    expect(updateMatchMany.mock.calls[0]?.[0]).toMatchObject({
      data: {
        endReason: endReasonFiveInARow,
        nextTurnSeat: null,
        stateVersion: 10,
        status: MatchStatus.FINISHED,
        winningSeat: Seat.WHITE,
      },
      where: {
        id: "solo-match",
        nextTurnSeat: Seat.WHITE,
        stateVersion: 9,
        status: MatchStatus.IN_PROGRESS,
      },
    });
    expect(updateParticipant.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: "human-player" }, data: { result: MatchResult.LOSS } },
      { where: { id: "ai-player" }, data: { result: MatchResult.WIN } },
    ]);
    expect(publishGameUpdate.mock.calls[0]?.[0]).toMatchObject({
      aiDifficulty: "master",
      lastMove: {
        moveNumber: 10,
        participantId: "ai-player",
      },
      mode: "ai",
      status: MatchStatus.FINISHED,
      winningSeat: Seat.WHITE,
    });
  });

  test("rejects stale AI turn requests before choosing a move", async () => {
    const storedMatch = matchRecord({ stateVersion: 10 });

    previewFindMatch.mockResolvedValueOnce(storedMatch);
    findMatch.mockResolvedValueOnce(storedMatch);

    const response = await route.POST(
      request({
        baseVersion: 9,
        participantId: "human-player",
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: "stale_state" });
    expect(chooseAiMove).not.toHaveBeenCalled();
    expect(updateMatchMany).not.toHaveBeenCalled();
    expect(createMove).not.toHaveBeenCalled();
    expect(publishGameUpdate).not.toHaveBeenCalled();
  });

  test("requires solo match metadata instead of inferring from display names", async () => {
    const storedMatch = matchRecord({ metadata: null });

    previewFindMatch.mockResolvedValueOnce(storedMatch);

    const response = await route.POST(
      request({
        baseVersion: 9,
        participantId: "human-player",
      }),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: "not_solo_match" });
    expect(transaction).not.toHaveBeenCalled();
    expect(chooseAiMove).not.toHaveBeenCalled();
  });
});
