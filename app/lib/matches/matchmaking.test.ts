import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "../../../generated/prisma/enums";

const transaction = mock();
const executeRaw = mock();
const createMatch = mock();
const findMatches = mock();
const updateMatch = mock();
const updateMatches = mock();
const createParticipant = mock();
const findParticipant = mock();
const updateParticipants = mock();

const tx = {
  $executeRaw: executeRaw,
  match: {
    create: createMatch,
    findMany: findMatches,
    update: updateMatch,
    updateMany: updateMatches,
  },
  matchParticipant: {
    create: createParticipant,
    findFirst: findParticipant,
    updateMany: updateParticipants,
  },
};

await mock.module("../prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

const {
  cancelMatchmakingQueue,
  cleanupStaleMatchSessions,
  endReasonAbandoned,
  endReasonQueueCancelled,
  endReasonQueueExpired,
  joinMatchmakingQueue,
} = await import("./matchmaking");

const now = new Date("2026-05-12T08:00:00.000Z");
const createdAt = new Date("2026-05-12T07:59:00.000Z");
const user = {
  displayName: "Ada",
  id: "user-ada",
  username: "ada",
};

function participant(overrides: Record<string, unknown> = {}) {
  return {
    displayNameSnapshot: "Ada",
    id: "participant-black",
    joinedAt: createdAt,
    leftAt: null,
    matchId: "match-1",
    result: null,
    role: Role.PLAYER,
    seat: Seat.BLACK,
    user: {
      displayName: "Ada",
      username: "ada",
    },
    userId: "user-ada",
    ...overrides,
  };
}

function match(overrides: Record<string, unknown> = {}) {
  return {
    boardSize: 15,
    createdAt,
    createdByUserId: "user-ada",
    endReason: null,
    finishedAt: null,
    id: "match-1",
    nextTurnSeat: null,
    participants: [participant()],
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

const serviceOptions = {
  inProgressTimeoutMs: 0,
  now,
  useAdvisoryLock: false,
  waitingTimeoutMs: 0,
};

beforeEach(() => {
  transaction.mockReset();
  executeRaw.mockReset();
  createMatch.mockReset();
  findMatches.mockReset();
  updateMatch.mockReset();
  updateMatches.mockReset();
  createParticipant.mockReset();
  findParticipant.mockReset();
  updateParticipants.mockReset();

  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
});

describe("joinMatchmakingQueue", () => {
  test("creates one waiting match for the first queued user", async () => {
    const queuedMatch = match();

    findParticipant.mockResolvedValueOnce(null);
    findMatches.mockResolvedValueOnce([]);
    createMatch.mockResolvedValueOnce(queuedMatch);

    const result = await joinMatchmakingQueue(user, serviceOptions);

    expect(result).toMatchObject({
      kind: "queued",
      queuePosition: 1,
      session: {
        matchId: "match-1",
        participantId: "participant-black",
        seat: Seat.BLACK,
        status: MatchStatus.WAITING,
      },
    });
    expect(createMatch.mock.calls[0]?.[0]).toMatchObject({
      data: {
        createdByUserId: "user-ada",
        participants: {
          create: {
            displayNameSnapshot: "Ada",
            seat: Seat.BLACK,
            userId: "user-ada",
          },
        },
        status: MatchStatus.WAITING,
      },
    });
  });

  test("pairs the next compatible queued user into the same match", async () => {
    const opponent = participant({
      displayNameSnapshot: "Grace",
      id: "participant-black",
      user: {
        displayName: "Grace",
        username: "grace",
      },
      userId: "user-grace",
    });
    const waitingMatch = match({
      createdByUserId: "user-grace",
      participants: [opponent],
    });
    const joiner = participant({
      displayNameSnapshot: "Ada",
      id: "participant-white",
      seat: Seat.WHITE,
      user: null,
      userId: "user-ada",
    });

    findParticipant.mockResolvedValueOnce(null);
    findMatches.mockResolvedValueOnce([waitingMatch]);
    createParticipant.mockResolvedValueOnce(joiner);
    updateMatch.mockResolvedValueOnce({});

    const result = await joinMatchmakingQueue(user, serviceOptions);

    expect(result).toMatchObject({
      kind: "matched",
      opponent: {
        session: {
          matchId: "match-1",
          participantId: "participant-black",
          seat: Seat.BLACK,
          status: MatchStatus.IN_PROGRESS,
        },
        username: "grace",
      },
      session: {
        matchId: "match-1",
        participantId: "participant-white",
        seat: Seat.WHITE,
        status: MatchStatus.IN_PROGRESS,
      },
    });
    expect(createParticipant).toHaveBeenCalledWith({
      data: {
        displayNameSnapshot: "Ada",
        matchId: "match-1",
        role: Role.PLAYER,
        seat: Seat.WHITE,
        userId: "user-ada",
      },
    });
    expect(updateMatch).toHaveBeenCalledWith({
      data: {
        nextTurnSeat: Seat.BLACK,
        startedAt: now,
        status: MatchStatus.IN_PROGRESS,
      },
      where: {
        id: "match-1",
      },
    });
  });

  test("reuses an existing queued session instead of creating duplicates", async () => {
    findParticipant.mockResolvedValueOnce({
      ...participant(),
      match: match(),
    });

    const result = await joinMatchmakingQueue(user, serviceOptions);

    expect(result).toMatchObject({
      kind: "queued",
      session: {
        matchId: "match-1",
        participantId: "participant-black",
      },
    });
    expect(findMatches).not.toHaveBeenCalled();
    expect(createMatch).not.toHaveBeenCalled();
  });
});

describe("cancelMatchmakingQueue", () => {
  test("cancels a waiting queue match without touching other matches", async () => {
    findParticipant.mockResolvedValueOnce({
      ...participant(),
      match: match(),
    });
    updateMatches.mockResolvedValueOnce({ count: 1 });
    updateParticipants.mockResolvedValueOnce({ count: 1 });

    const result = await cancelMatchmakingQueue(user, serviceOptions);

    expect(result).toEqual({
      kind: "cancelled",
      matchId: "match-1",
    });
    expect(updateMatches).toHaveBeenCalledWith({
      data: {
        endReason: endReasonQueueCancelled,
        finishedAt: now,
        nextTurnSeat: null,
        status: MatchStatus.CANCELLED,
      },
      where: {
        id: "match-1",
        status: MatchStatus.WAITING,
      },
    });
    expect(updateParticipants).toHaveBeenCalledWith({
      data: {
        leftAt: now,
        result: MatchResult.CANCELLED,
      },
      where: {
        leftAt: null,
        matchId: "match-1",
        result: null,
      },
    });
  });

  test("reports an already-started match instead of cancelling it", async () => {
    findParticipant.mockResolvedValueOnce({
      ...participant({ id: "participant-white", seat: Seat.WHITE }),
      match: match({
        nextTurnSeat: Seat.BLACK,
        startedAt: now,
        status: MatchStatus.IN_PROGRESS,
      }),
    });

    const result = await cancelMatchmakingQueue(user, serviceOptions);

    expect(result).toMatchObject({
      kind: "already_matched",
      session: {
        matchId: "match-1",
        status: MatchStatus.IN_PROGRESS,
      },
    });
    expect(updateMatches).not.toHaveBeenCalled();
    expect(updateParticipants).not.toHaveBeenCalled();
  });
});

describe("cleanupStaleMatchSessions", () => {
  test("expires stale waiting matches and abandoned in-progress matches", async () => {
    findMatches.mockResolvedValueOnce([{ id: "waiting-1" }]);
    updateMatches.mockResolvedValueOnce({ count: 1 });
    updateParticipants.mockResolvedValueOnce({ count: 1 });
    findMatches.mockResolvedValueOnce([{ id: "game-1" }]);
    updateMatches.mockResolvedValueOnce({ count: 1 });
    updateParticipants.mockResolvedValueOnce({ count: 2 });

    const result = await cleanupStaleMatchSessions({
      inProgressTimeoutMs: 2_000,
      now,
      useAdvisoryLock: false,
      waitingTimeoutMs: 1_000,
    });

    expect(result).toEqual({
      inProgressCancelled: 1,
      waitingCancelled: 1,
    });
    expect(updateMatches.mock.calls[0]?.[0]).toMatchObject({
      data: {
        endReason: endReasonQueueExpired,
        status: MatchStatus.CANCELLED,
      },
      where: {
        id: {
          in: ["waiting-1"],
        },
      },
    });
    expect(updateMatches.mock.calls[1]?.[0]).toMatchObject({
      data: {
        endReason: endReasonAbandoned,
        status: MatchStatus.CANCELLED,
      },
      where: {
        id: {
          in: ["game-1"],
        },
      },
    });
  });
});
