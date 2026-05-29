import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  Seat,
} from "../../../generated/prisma/enums";

const transaction = mock();
const findMatch = mock();
const updateMatches = mock();
const updateParticipant = mock();

const tx = {
  match: {
    findUnique: findMatch,
    updateMany: updateMatches,
  },
  matchParticipant: {
    update: updateParticipant,
  },
};

await mock.module("../prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

const { endReasonDisconnectForfeit, forfeitDisconnectedParticipant } =
  await import("./disconnect-forfeit");

const now = new Date("2026-05-12T08:00:00.000Z");

function participant(overrides: Record<string, unknown> = {}) {
  return {
    displayNameSnapshot: "Ada",
    id: "black-player",
    leftAt: null,
    role: Role.PLAYER,
    seat: Seat.BLACK,
    userId: "user-black",
    ...overrides,
  };
}

function matchRecord(overrides: Record<string, unknown> = {}) {
  return {
    boardSize: 15,
    endReason: null,
    id: "match-1",
    metadata: null,
    moves: [],
    nextTurnSeat: Seat.WHITE,
    participants: [
      participant(),
      participant({
        displayNameSnapshot: "Grace",
        id: "white-player",
        seat: Seat.WHITE,
        userId: "user-white",
      }),
    ],
    stateVersion: 4,
    status: MatchStatus.IN_PROGRESS,
    visibility: MatchVisibility.PUBLIC,
    winningSeat: null,
    ...overrides,
  };
}

beforeEach(() => {
  transaction.mockReset();
  findMatch.mockReset();
  updateMatches.mockReset();
  updateParticipant.mockReset();

  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
  updateParticipant.mockResolvedValue({});
});

describe("forfeitDisconnectedParticipant", () => {
  test("finishes an in-progress match with a loss for the disconnected participant", async () => {
    findMatch.mockResolvedValueOnce(matchRecord());
    updateMatches.mockResolvedValueOnce({ count: 1 });

    const result = await forfeitDisconnectedParticipant("match-1", "white-player", {
      now,
      syncStats: false,
    });

    expect(result).toMatchObject({
      gameUpdate: {
        endReason: endReasonDisconnectForfeit,
        matchId: "match-1",
        stateVersion: 5,
        status: MatchStatus.FINISHED,
        winningSeat: Seat.BLACK,
      },
      kind: "forfeited",
      matchId: "match-1",
      stateVersion: 5,
    });
    expect(updateMatches).toHaveBeenCalledWith({
      data: {
        endReason: endReasonDisconnectForfeit,
        finishedAt: now,
        nextTurnSeat: null,
        stateVersion: 5,
        status: MatchStatus.FINISHED,
        winningSeat: Seat.BLACK,
      },
      where: {
        id: "match-1",
        stateVersion: 4,
        status: MatchStatus.IN_PROGRESS,
      },
    });
    expect(updateParticipant).toHaveBeenNthCalledWith(1, {
      data: { result: MatchResult.LOSS },
      where: { id: "white-player" },
    });
    expect(updateParticipant).toHaveBeenNthCalledWith(2, {
      data: { result: MatchResult.WIN },
      where: { id: "black-player" },
    });
  });

  test("does not forfeit when the participant reconnects before the guarded transition", async () => {
    findMatch.mockResolvedValueOnce(matchRecord());

    const result = await forfeitDisconnectedParticipant("match-1", "white-player", {
      shouldForfeit: () => false,
      syncStats: false,
    });

    expect(result).toEqual({
      kind: "reconnected",
      matchId: "match-1",
    });
    expect(updateMatches).not.toHaveBeenCalled();
    expect(updateParticipant).not.toHaveBeenCalled();
  });
});
