import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "../../../generated/prisma/enums";
import type { MatchHistoryRecord } from "./match-history";

const countMatches = mock();
const findManyMatches = mock();

await mock.module("../prisma", () => ({
  prisma: {
    match: {
      count: countMatches,
      findMany: findManyMatches,
    },
  },
}));

const {
  MATCH_HISTORY_DEFAULT_LIMIT,
  MATCH_HISTORY_MAX_LIMIT,
  buildMatchHistoryQuery,
  getMatchHistoryPageForUser,
  normalizeMatchHistoryLimit,
  normalizeMatchHistoryPage,
  toMatchHistoryEntry,
} = await import("./match-history");

const createdAt = new Date("2026-05-14T09:00:00.000Z");
const startedAt = new Date("2026-05-14T09:01:00.000Z");
const finishedAt = new Date("2026-05-14T09:12:00.000Z");

function historyRecord(): MatchHistoryRecord {
  return {
    boardSize: 3,
    createdAt,
    endReason: "five_in_a_row",
    finishedAt,
    id: "match-1",
    moves: [
      {
        baseVersion: 0,
        createdAt: new Date("2026-05-14T09:01:10.000Z"),
        moveNumber: 1,
        participantId: "participant-black",
        requestId: "request-1",
        stateVersion: 1,
        x: 1,
        y: 1,
      },
      {
        baseVersion: 1,
        createdAt: new Date("2026-05-14T09:01:20.000Z"),
        moveNumber: 2,
        participantId: "participant-white",
        requestId: "request-2",
        stateVersion: 2,
        x: 0,
        y: 1,
      },
    ],
    participants: [
      {
        displayNameSnapshot: "Ada",
        id: "participant-black",
        joinedAt: startedAt,
        leftAt: finishedAt,
        result: MatchResult.WIN,
        role: Role.PLAYER,
        seat: Seat.BLACK,
        user: {
          displayName: "Ada Lovelace",
          id: "user-ada",
          username: "ada",
        },
        userId: "user-ada",
      },
      {
        displayNameSnapshot: "Grace",
        id: "participant-white",
        joinedAt: startedAt,
        leftAt: finishedAt,
        result: MatchResult.LOSS,
        role: Role.PLAYER,
        seat: Seat.WHITE,
        user: {
          displayName: "Grace Hopper",
          id: "user-grace",
          username: "grace",
        },
        userId: "user-grace",
      },
    ],
    ruleType: RuleType.GOMOKU,
    startedAt,
    stateVersion: 2,
    status: MatchStatus.FINISHED,
    updatedAt: finishedAt,
    visibility: MatchVisibility.PUBLIC,
    winningSeat: Seat.BLACK,
  };
}

beforeEach(() => {
  countMatches.mockReset();
  findManyMatches.mockReset();
});

describe("match history read model", () => {
  test("serializes opponent ids, timestamps, result state, moves, and board", () => {
    const entry = toMatchHistoryEntry(historyRecord(), "user-ada");

    expect(entry).toMatchObject({
      matchId: "match-1",
      status: MatchStatus.FINISHED,
      startedAt: "2026-05-14T09:01:00.000Z",
      finishedAt: "2026-05-14T09:12:00.000Z",
      result: MatchResult.WIN,
      currentUserParticipantId: "participant-black",
      opponentUserIds: ["user-grace"],
      moveCount: 2,
      participants: [
        {
          participantId: "participant-black",
          userId: "user-ada",
          username: "ada",
          displayName: "Ada Lovelace",
          result: MatchResult.WIN,
          joinedAt: "2026-05-14T09:01:00.000Z",
          leftAt: "2026-05-14T09:12:00.000Z",
        },
        {
          participantId: "participant-white",
          userId: "user-grace",
          result: MatchResult.LOSS,
        },
      ],
      moves: [
        {
          moveNumber: 1,
          participantId: "participant-black",
          position: { x: 1, y: 1 },
          playedAt: "2026-05-14T09:01:10.000Z",
          stateVersion: 1,
        },
        {
          moveNumber: 2,
          participantId: "participant-white",
          position: { x: 0, y: 1 },
          playedAt: "2026-05-14T09:01:20.000Z",
          stateVersion: 2,
        },
      ],
    });
    expect(entry.board[1]?.[1]).toEqual({
      moveNumber: 1,
      occupied: true,
      seat: Seat.BLACK,
    });
    expect(entry.board[1]?.[0]).toEqual({
      moveNumber: 2,
      occupied: true,
      seat: Seat.WHITE,
    });
  });

  test("builds a bounded terminal-match query for the authenticated user", () => {
    expect(buildMatchHistoryQuery("user-ada", 25)).toMatchObject({
      orderBy: [{ finishedAt: "desc" }, { updatedAt: "desc" }],
      select: expect.any(Object),
      take: 25,
      where: {
        participants: {
          some: {
            userId: "user-ada",
          },
        },
        status: {
          in: [MatchStatus.FINISHED, MatchStatus.CANCELLED],
        },
      },
    });
  });

  test("normalizes history limits for callers", () => {
    expect(normalizeMatchHistoryLimit(null)).toBe(MATCH_HISTORY_DEFAULT_LIMIT);
    expect(normalizeMatchHistoryLimit(0)).toBe(1);
    expect(normalizeMatchHistoryLimit(500)).toBe(MATCH_HISTORY_MAX_LIMIT);
    expect(normalizeMatchHistoryLimit(2.5)).toBe(MATCH_HISTORY_DEFAULT_LIMIT);
  });

  test("normalizes history pages for callers", () => {
    expect(normalizeMatchHistoryPage(null)).toBe(1);
    expect(normalizeMatchHistoryPage(0)).toBe(1);
    expect(normalizeMatchHistoryPage(-3)).toBe(1);
    expect(normalizeMatchHistoryPage(2.5)).toBe(1);
    expect(normalizeMatchHistoryPage(4)).toBe(4);
  });

  test("builds paged history queries with the normalized skip offset", () => {
    expect(buildMatchHistoryQuery("user-ada", 10, 3)).toMatchObject({
      skip: 20,
      take: 10,
    });
    expect(buildMatchHistoryQuery("user-ada", 10, -1)).toMatchObject({
      skip: 0,
      take: 10,
    });
  });

  test("clamps paged history reads to the last available page", async () => {
    countMatches.mockResolvedValueOnce(12);
    findManyMatches.mockResolvedValueOnce([]);

    const page = await getMatchHistoryPageForUser("user-ada", 999, 5);

    expect(page).toMatchObject({
      entries: [],
      page: 3,
      limit: 5,
      totalMatches: 12,
      totalPages: 3,
    });
    expect(findManyMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
      }),
    );
  });

  test("keeps empty history pages on page one with default pagination metadata", async () => {
    countMatches.mockResolvedValueOnce(0);
    findManyMatches.mockResolvedValueOnce([]);

    const page = await getMatchHistoryPageForUser("user-ada", 3, 10);

    expect(page).toMatchObject({
      entries: [],
      page: 1,
      limit: 10,
      totalMatches: 0,
      totalPages: 1,
    });
    expect(findManyMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      }),
    );
  });
});
