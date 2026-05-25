import { describe, expect, test } from "bun:test";

import { MatchResult, RuleType } from "../../generated/prisma/enums";
import {
  LEADERBOARD_SEARCH_DEFAULT_LIMIT,
  LEADERBOARD_SEARCH_MAX_LIMIT,
  MATCH_HISTORY_SEARCH_DEFAULT_LIMIT,
  MATCH_HISTORY_SEARCH_MAX_LIMIT,
  buildLeaderboardFilterWhere,
  buildMatchHistoryFilterWhere,
  parseLeaderboardSearchParams,
  parseMatchHistorySearchParams,
} from "./advanced-search";

describe("advanced search parsing", () => {
  test("normalizes leaderboard params and caps limits", () => {
    const query = parseLeaderboardSearchParams(
      new URLSearchParams({
        band: "kyu",
        limit: "999",
        maxRating: "1800",
        minMatches: "-4",
        minRating: "1000",
        page: "3",
        q: "  Ada  ",
        scope: "friends",
        sort: "wins_desc",
      }),
    );

    expect(query).toEqual({
      q: "Ada",
      scope: "friends",
      band: "kyu",
      minRating: 1000,
      maxRating: 1800,
      minMatches: -4,
      sort: "wins_desc",
      page: 3,
      limit: LEADERBOARD_SEARCH_MAX_LIMIT,
    });
  });

  test("falls back for invalid leaderboard params", () => {
    const query = parseLeaderboardSearchParams(
      new URLSearchParams({
        band: "master",
        limit: "NaN",
        page: "0",
        scope: "team",
        sort: "rating_desc",
      }),
    );

    expect(query).toMatchObject({
      scope: "all",
      band: "all",
      sort: "rank",
      page: 1,
      limit: LEADERBOARD_SEARCH_DEFAULT_LIMIT,
    });
  });

  test("defers win-rate sorting until it has a bounded query strategy", () => {
    const query = parseLeaderboardSearchParams(new URLSearchParams({ sort: "win_rate_desc" }));

    expect(query.sort).toBe("rank");
  });

  test("builds leaderboard Prisma filters for player, rank band, rating, and match floor", () => {
    expect(
      buildLeaderboardFilterWhere({
        q: "ada",
        band: "dan",
        minRating: 1800,
        maxRating: 2200,
        minMatches: 5,
      }),
    ).toEqual({
      AND: [
        {
          user: {
            OR: [
              { displayName: { contains: "ada", mode: "insensitive" } },
              { username: { contains: "ada", mode: "insensitive" } },
            ],
          },
        },
        { rating: { gte: 1800 } },
        { rating: { gte: 1800, lte: 2200 } },
        { matchesPlayed: { gte: 5 } },
      ],
    });
  });

  test("normalizes match-history params, date bounds, and caps limits", () => {
    const query = parseMatchHistorySearchParams(
      new URLSearchParams({
        dateFrom: "2026-05-01",
        dateTo: "2026-05-25",
        limit: "999",
        matchType: "RENJU",
        opponent: " Grace ",
        page: "2",
        result: "win",
        sort: "moves_asc",
      }),
    );

    expect(query).toEqual({
      opponent: "Grace",
      result: MatchResult.WIN,
      matchType: "renju",
      dateFrom: new Date("2026-05-01T00:00:00.000Z"),
      dateTo: new Date("2026-05-25T23:59:59.999Z"),
      sort: "moves_asc",
      page: 2,
      limit: MATCH_HISTORY_SEARCH_MAX_LIMIT,
    });
  });

  test("falls back for invalid match-history params", () => {
    const query = parseMatchHistorySearchParams(
      new URLSearchParams({
        dateFrom: "not-a-date",
        limit: "-3",
        matchType: "chess",
        result: "pending",
        sort: "rating",
      }),
    );

    expect(query).toMatchObject({
      result: "all",
      matchType: "all",
      dateFrom: null,
      sort: "newest",
      page: 1,
      limit: MATCH_HISTORY_SEARCH_DEFAULT_LIMIT,
    });
  });

  test("builds match-history Prisma filters for opponent, result, type, and dates", () => {
    expect(
      buildMatchHistoryFilterWhere("user-ada", {
        opponent: "grace",
        result: MatchResult.LOSS,
        matchType: "gomoku",
        dateFrom: new Date("2026-05-01T00:00:00.000Z"),
        dateTo: new Date("2026-05-25T23:59:59.999Z"),
      }),
    ).toEqual({
      AND: [
        {
          participants: {
            some: {
              userId: { not: "user-ada" },
              OR: [
                { displayNameSnapshot: { contains: "grace", mode: "insensitive" } },
                { user: { displayName: { contains: "grace", mode: "insensitive" } } },
                { user: { username: { contains: "grace", mode: "insensitive" } } },
              ],
            },
          },
        },
        {
          participants: {
            some: {
              result: MatchResult.LOSS,
              userId: "user-ada",
            },
          },
        },
        { ruleType: RuleType.GOMOKU },
        {
          finishedAt: {
            gte: new Date("2026-05-01T00:00:00.000Z"),
            lte: new Date("2026-05-25T23:59:59.999Z"),
          },
        },
      ],
    });
  });
});
