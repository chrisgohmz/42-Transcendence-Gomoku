import type { Prisma } from "../../generated/prisma/client";
import { MatchResult, RuleType } from "../../generated/prisma/enums";
import type { LeaderboardScope } from "./leaderboard";

export const LEADERBOARD_SEARCH_DEFAULT_LIMIT = 10;
export const LEADERBOARD_SEARCH_MAX_LIMIT = 50;
export const MATCH_HISTORY_SEARCH_DEFAULT_LIMIT = 10;
export const MATCH_HISTORY_SEARCH_MAX_LIMIT = 50;

export type LeaderboardRankBand = "all" | "dan" | "kyu" | "unranked";
export type LeaderboardSort = "rank" | "rating_asc" | "wins_desc" | "matches_desc";

export type LeaderboardSearchQuery = {
  q: string;
  scope: LeaderboardScope;
  band: LeaderboardRankBand;
  minRating: number | null;
  maxRating: number | null;
  minMatches: number | null;
  sort: LeaderboardSort;
  page: number;
  limit: number;
};

export type MatchHistoryResultFilter = "all" | MatchResult;
export type MatchHistoryTypeFilter = "all" | Lowercase<keyof typeof RuleType>;
export type MatchHistorySort = "newest" | "oldest" | "moves_desc" | "moves_asc";

export type MatchHistorySearchQuery = {
  opponent: string;
  result: MatchHistoryResultFilter;
  matchType: MatchHistoryTypeFilter;
  dateFrom: Date | null;
  dateTo: Date | null;
  sort: MatchHistorySort;
  page: number;
  limit: number;
};

function firstParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value === null ? null : value.trim();
}

function integerParam(params: URLSearchParams, key: string, fallback: number): number {
  const raw = firstParam(params, key);
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isInteger(value) ? value : fallback;
}

function optionalIntegerParam(params: URLSearchParams, key: string): number | null {
  const raw = firstParam(params, key);
  if (!raw) return null;

  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

function boundedPositive(value: number, fallback: number, max: number): number {
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, max);
}

function dateParam(params: URLSearchParams, key: string, endOfDay = false): Date | null {
  const raw = firstParam(params, key);
  if (!raw) return null;

  const date = new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseLeaderboardSearchParams(params: URLSearchParams): LeaderboardSearchQuery {
  const band = firstParam(params, "band");
  const sort = firstParam(params, "sort");

  return {
    q: firstParam(params, "q") ?? "",
    scope: firstParam(params, "scope") === "friends" ? "friends" : "all",
    band: band === "dan" || band === "kyu" || band === "unranked" ? band : "all",
    minRating: optionalIntegerParam(params, "minRating"),
    maxRating: optionalIntegerParam(params, "maxRating"),
    minMatches: optionalIntegerParam(params, "minMatches"),
    sort: sort === "rating_asc" || sort === "wins_desc" || sort === "matches_desc" ? sort : "rank",
    page: boundedPositive(integerParam(params, "page", 1), 1, Number.MAX_SAFE_INTEGER),
    limit: boundedPositive(
      integerParam(params, "limit", LEADERBOARD_SEARCH_DEFAULT_LIMIT),
      LEADERBOARD_SEARCH_DEFAULT_LIMIT,
      LEADERBOARD_SEARCH_MAX_LIMIT,
    ),
  };
}

export function buildLeaderboardFilterWhere(
  query: Pick<LeaderboardSearchQuery, "q" | "band" | "minRating" | "maxRating" | "minMatches">,
): Prisma.UserGameStatsWhereInput {
  const where: Prisma.UserGameStatsWhereInput = {};
  const AND: Prisma.UserGameStatsWhereInput[] = [];

  if (query.q) {
    AND.push({
      user: {
        OR: [
          { displayName: { contains: query.q, mode: "insensitive" } },
          { username: { contains: query.q, mode: "insensitive" } },
        ],
      },
    });
  }

  if (query.band === "dan") {
    AND.push({ rating: { gte: 1800 } });
  } else if (query.band === "kyu") {
    AND.push({ rating: { gte: 1000, lt: 1800 } });
  } else if (query.band === "unranked") {
    AND.push({
      OR: [{ rating: null }, { rating: { lt: 1000 } }],
    });
  }

  if (query.minRating !== null || query.maxRating !== null) {
    AND.push({
      rating: {
        ...(query.minRating !== null ? { gte: query.minRating } : {}),
        ...(query.maxRating !== null ? { lte: query.maxRating } : {}),
      },
    });
  }

  if (query.minMatches !== null) {
    AND.push({ matchesPlayed: { gte: Math.max(query.minMatches, 0) } });
  }

  if (AND.length > 0) {
    where.AND = AND;
  }

  return where;
}

export function parseMatchHistorySearchParams(params: URLSearchParams): MatchHistorySearchQuery {
  const result = firstParam(params, "result")?.toUpperCase();
  const matchType = firstParam(params, "matchType")?.toLowerCase();
  const sort = firstParam(params, "sort");

  return {
    opponent: firstParam(params, "opponent") ?? "",
    result:
      result === MatchResult.WIN ||
      result === MatchResult.LOSS ||
      result === MatchResult.DRAW ||
      result === MatchResult.CANCELLED
        ? result
        : "all",
    matchType: matchType === "renju" || matchType === "gomoku" ? matchType : "all",
    dateFrom: dateParam(params, "dateFrom"),
    dateTo: dateParam(params, "dateTo", true),
    sort: sort === "oldest" || sort === "moves_desc" || sort === "moves_asc" ? sort : "newest",
    page: boundedPositive(integerParam(params, "page", 1), 1, Number.MAX_SAFE_INTEGER),
    limit: boundedPositive(
      integerParam(params, "limit", MATCH_HISTORY_SEARCH_DEFAULT_LIMIT),
      MATCH_HISTORY_SEARCH_DEFAULT_LIMIT,
      MATCH_HISTORY_SEARCH_MAX_LIMIT,
    ),
  };
}

export function buildMatchHistoryFilterWhere(
  currentUserId: string,
  query: Pick<MatchHistorySearchQuery, "opponent" | "result" | "matchType" | "dateFrom" | "dateTo">,
): Prisma.MatchWhereInput {
  const AND: Prisma.MatchWhereInput[] = [];

  if (query.opponent) {
    AND.push({
      participants: {
        some: {
          userId: { not: currentUserId },
          OR: [
            { displayNameSnapshot: { contains: query.opponent, mode: "insensitive" } },
            { user: { displayName: { contains: query.opponent, mode: "insensitive" } } },
            { user: { username: { contains: query.opponent, mode: "insensitive" } } },
          ],
        },
      },
    });
  }

  if (query.result !== "all") {
    AND.push({
      participants: {
        some: {
          result: query.result,
          userId: currentUserId,
        },
      },
    });
  }

  if (query.matchType !== "all") {
    AND.push({ ruleType: query.matchType === "renju" ? RuleType.RENJU : RuleType.GOMOKU });
  }

  if (query.dateFrom || query.dateTo) {
    AND.push({
      finishedAt: {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      },
    });
  }

  return AND.length > 0 ? { AND } : {};
}
