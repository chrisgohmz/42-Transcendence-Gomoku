//import { cacheLife } from "next/cache";

import type { Prisma } from "../../generated/prisma/client";
import { RuleType } from "../../generated/prisma/enums";
import {
  buildLeaderboardFilterWhere,
  type LeaderboardSearchQuery,
  type LeaderboardSort,
} from "./advanced-search";
import { getAcceptedFriendIdsForUser } from "./friendships/friendship-queries";
import { prisma } from "./prisma";

export const LEADERBOARD_BOARD_SIZE = 15;
export const LEADERBOARD_LIMIT = 100;
export const LEADERBOARD_FETCH_LIMIT = LEADERBOARD_LIMIT * 3;
export const LEADERBOARD_RULE_TYPE = RuleType.GOMOKU;

const leaderboardSelect = {
  botMatchesPlayed: true,
  losses: true,
  matchesPlayed: true,
  rating: true,
  userId: true,
  wins: true,
  user: {
    select: {
      displayName: true,
    },
  },
} satisfies Prisma.UserGameStatsSelect;

type LeaderboardStat = Prisma.UserGameStatsGetPayload<{
  select: typeof leaderboardSelect;
}>;

const leaderboardEligibilitySelect = {
  botMatchesPlayed: true,
  matchesPlayed: true,
} satisfies Prisma.UserGameStatsSelect;

type LeaderboardEligibilityStat = Prisma.UserGameStatsGetPayload<{
  select: typeof leaderboardEligibilitySelect;
}>;

export type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: string;
};

export type LeaderboardSnapshot = {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  pagination?: {
    page: number;
    limit: number;
    totalEntries: number;
    totalPages: number;
  };
};

export type LeaderboardScope = "all" | "friends";

export type LeaderboardSnapshotOptions = {
  scope?: LeaderboardScope;
};

export type LeaderboardRankInput = {
  rating: number | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
  botMatchesPlayed: number;
};

export const leaderboardBaseWhere = {
  boardSize: LEADERBOARD_BOARD_SIZE,
  ruleType: LEADERBOARD_RULE_TYPE,
} satisfies Prisma.UserGameStatsWhereInput;

export const leaderboardRankedWhere = {
  ...leaderboardBaseWhere,
  matchesPlayed: { gt: 0 },
} satisfies Prisma.UserGameStatsWhereInput;

export const leaderboardRankingOrder = [
  { rating: "desc" },
  { wins: "desc" },
  { losses: "asc" },
] satisfies Prisma.UserGameStatsOrderByWithRelationInput[];

export const leaderboardQueryArgs = {
  orderBy: leaderboardRankingOrder,
  select: leaderboardSelect,
  take: LEADERBOARD_FETCH_LIMIT,
  where: leaderboardRankedWhere,
} satisfies Prisma.UserGameStatsFindManyArgs;

function buildLeaderboardWhere(friendUserIds: string[] | null): Prisma.UserGameStatsWhereInput {
  if (!friendUserIds) {
    return leaderboardRankedWhere;
  }

  return {
    ...leaderboardRankedWhere,
    userId: {
      in: friendUserIds,
    },
  };
}

async function getFriendsScopeUserIds(userId: string): Promise<string[]> {
  const friendUserIds = await getAcceptedFriendIdsForUser(userId, prisma);
  return [userId, ...friendUserIds.filter((friendUserId) => friendUserId !== userId)];
}

export function formatWinRate(wins: number, matchesPlayed: number): string {
  if (matchesPlayed === 0) {
    return "0.00%";
  }

  return `${((wins / matchesPlayed) * 100).toFixed(2)}%`;
}

function isLeaderboardEligible(stat: { matchesPlayed: number; botMatchesPlayed: number }): boolean {
  return stat.matchesPlayed > stat.botMatchesPlayed;
}

export function buildLeaderboardAheadWhere(
  stats: LeaderboardRankInput,
  friendUserIds: string[] | null = null,
): Prisma.UserGameStatsWhereInput | null {
  if (stats.matchesPlayed === 0 || stats.matchesPlayed <= stats.botMatchesPlayed) {
    return null;
  }

  const aheadByRating: Prisma.UserGameStatsWhereInput =
    stats.rating === null ? { rating: { not: null } } : { rating: { gt: stats.rating } };

  const aheadWithinRating: Prisma.UserGameStatsWhereInput = {
    rating: stats.rating,
    OR: [
      { wins: { gt: stats.wins } },
      {
        wins: stats.wins,
        losses: { lt: stats.losses },
      },
    ],
  };

  return {
    ...buildLeaderboardWhere(friendUserIds),
    OR: [aheadByRating, aheadWithinRating],
  };
}

function toLeaderboardEntry(stat: LeaderboardStat, rank: number): LeaderboardEntry {
  return {
    playerId: stat.userId,
    rank,
    player: stat.user.displayName,
    rating: stat.rating ?? 0,
    matchesPlayed: stat.matchesPlayed,
    wins: stat.wins,
    losses: stat.losses,
    winRate: formatWinRate(stat.wins, stat.matchesPlayed),
  };
}

export function toLeaderboardEntries(stats: LeaderboardStat[]): LeaderboardEntry[] {
  return stats
    .filter(isLeaderboardEligible)
    .map((stat, index) => toLeaderboardEntry(stat, index + 1));
}

async function getLeaderboardEntries(
  friendUserIds: string[] | null = null,
): Promise<LeaderboardEntry[]> {
  // Fetch in batches and collect eligible (human) rows until we have
  // `LEADERBOARD_LIMIT` entries or the dataset is exhausted. This moves
  // the eligibility filter into the data/query boundary and avoids
  // returning fewer than `LEADERBOARD_LIMIT` entries on bot-heavy data.
  const results: LeaderboardEntry[] = [];
  let skip = 0;
  const where = buildLeaderboardWhere(friendUserIds);

  if (friendUserIds && friendUserIds.length === 0) {
    return results;
  }

  while (results.length < LEADERBOARD_LIMIT) {
    const args = {
      ...leaderboardQueryArgs,
      skip,
      take: LEADERBOARD_FETCH_LIMIT,
      where,
    } as Prisma.UserGameStatsFindManyArgs;

    const stats = (await prisma.userGameStats.findMany(args)) as unknown as LeaderboardStat[];

    if (stats.length === 0) break;

    for (const stat of stats) {
      if (!isLeaderboardEligible(stat)) continue;

      const rank = results.length + 1;
      results.push(toLeaderboardEntry(stat, rank));

      if (results.length >= LEADERBOARD_LIMIT) break;
    }

    if (stats.length < LEADERBOARD_FETCH_LIMIT) break;

    skip += LEADERBOARD_FETCH_LIMIT;
  }

  return results.slice(0, LEADERBOARD_LIMIT);
}

export async function getLeaderboardRank(
  input: LeaderboardRankInput,
  friendUserIds: string[] | null = null,
): Promise<number | null> {
  const aheadWhere = buildLeaderboardAheadWhere(input, friendUserIds);

  if (!aheadWhere) {
    return null;
  }

  const allAhead = await prisma.userGameStats.findMany({
    where: aheadWhere,
    select: {
      botMatchesPlayed: true,
      matchesPlayed: true,
    },
  });

  const aheadCount = allAhead.filter(isLeaderboardEligible).length;

  return aheadCount + 1;
}

export async function getLeaderboardSpotlight(
  userId: string,
  friendUserIds: string[] | null = null,
): Promise<LeaderboardEntry | null> {
  const stats = await prisma.userGameStats.findUnique({
    where: {
      userId_ruleType_boardSize: {
        userId,
        ruleType: LEADERBOARD_RULE_TYPE,
        boardSize: LEADERBOARD_BOARD_SIZE,
      },
    },
    select: leaderboardSelect,
  });

  if (!stats || !isLeaderboardEligible(stats)) {
    return null;
  }

  const rank = await getLeaderboardRank(
    {
      rating: stats.rating,
      wins: stats.wins,
      losses: stats.losses,
      matchesPlayed: stats.matchesPlayed,
      botMatchesPlayed: stats.botMatchesPlayed,
    },
    friendUserIds,
  );

  return rank === null ? null : toLeaderboardEntry(stats, rank);
}

export async function getLeaderboardSnapshot(
  userId: string | null,
  options: Pick<LeaderboardSnapshotOptions, "scope"> = {},
): Promise<LeaderboardSnapshot> {
  const scope = options.scope ?? "all";

  if (scope === "friends") {
    if (!userId) {
      return { entries: [], currentUser: null };
    }

    const friendScopeUserIds = await getFriendsScopeUserIds(userId);
    const entries = await getLeaderboardEntries(friendScopeUserIds);
    const currentUser =
      entries.find((entry) => entry.playerId === userId) ??
      (await getLeaderboardSpotlight(userId, friendScopeUserIds));

    return { entries, currentUser };
  }

  const [entries, currentUser] = await Promise.all([
    getLeaderboardEntries(),
    userId ? getLeaderboardSpotlight(userId) : Promise.resolve(null),
  ]);

  return { entries, currentUser };
}

function mergeLeaderboardWhere(
  baseWhere: Prisma.UserGameStatsWhereInput,
  filterWhere: Prisma.UserGameStatsWhereInput,
): Prisma.UserGameStatsWhereInput {
  if (Object.keys(filterWhere).length === 0) {
    return baseWhere;
  }

  return {
    AND: [baseWhere, filterWhere],
  };
}

function getLeaderboardSearchOrderBy(
  sort: LeaderboardSort,
): Prisma.UserGameStatsOrderByWithRelationInput[] {
  if (sort === "rating_asc") {
    return [{ rating: "asc" }, { wins: "desc" }, { losses: "asc" }];
  }

  if (sort === "wins_desc") {
    return [{ wins: "desc" }, { rating: "desc" }, { losses: "asc" }];
  }

  if (sort === "matches_desc") {
    return [{ matchesPlayed: "desc" }, { rating: "desc" }, { wins: "desc" }];
  }

  if (sort === "rank") {
    return leaderboardRankingOrder;
  }

  return leaderboardRankingOrder;
}

async function countEligibleLeaderboardSearchEntries(
  where: Prisma.UserGameStatsWhereInput,
): Promise<number> {
  const stats = (await prisma.userGameStats.findMany({
    select: leaderboardEligibilitySelect,
    where,
  })) as unknown as LeaderboardEligibilityStat[];

  return stats.filter(isLeaderboardEligible).length;
}

async function getLeaderboardSearchPage(
  where: Prisma.UserGameStatsWhereInput,
  sort: LeaderboardSort,
  page: number,
  limit: number,
): Promise<LeaderboardStat[]> {
  const orderBy = getLeaderboardSearchOrderBy(sort);
  const targetEligibleCount = page * limit;
  const eligibleStats: LeaderboardStat[] = [];
  const batchSize = Math.max(LEADERBOARD_FETCH_LIMIT, limit * 3);
  let skip = 0;

  while (eligibleStats.length < targetEligibleCount) {
    const stats = (await prisma.userGameStats.findMany({
      orderBy,
      select: leaderboardSelect,
      skip,
      take: batchSize,
      where,
    })) as unknown as LeaderboardStat[];

    if (stats.length === 0) break;

    eligibleStats.push(...stats.filter(isLeaderboardEligible));

    if (stats.length < batchSize) break;

    skip += batchSize;
  }

  return eligibleStats.slice((page - 1) * limit, page * limit);
}

export async function getLeaderboardSearchSnapshot(
  userId: string | null,
  query: LeaderboardSearchQuery,
): Promise<LeaderboardSnapshot> {
  const friendUserIds =
    query.scope === "friends" && userId ? await getFriendsScopeUserIds(userId) : null;

  if (query.scope === "friends" && (!userId || friendUserIds?.length === 0)) {
    return {
      entries: [],
      currentUser: null,
      pagination: {
        page: 1,
        limit: query.limit,
        totalEntries: 0,
        totalPages: 1,
      },
    };
  }

  const baseWhere = buildLeaderboardWhere(friendUserIds);
  const filterWhere = buildLeaderboardFilterWhere(query);
  const where = mergeLeaderboardWhere(baseWhere, filterWhere);
  const totalEntries = await countEligibleLeaderboardSearchEntries(where);
  const totalPages = Math.max(1, Math.ceil(totalEntries / query.limit));
  const currentPage = Math.min(query.page, totalPages);
  const startIndex = (currentPage - 1) * query.limit;
  const pageStats = await getLeaderboardSearchPage(where, query.sort, currentPage, query.limit);
  const entries = pageStats.map((stat, index) => toLeaderboardEntry(stat, startIndex + index + 1));
  const currentUser =
    entries.find((entry) => entry.playerId === userId) ??
    (userId ? await getLeaderboardSpotlight(userId, friendUserIds) : null);

  return {
    entries,
    currentUser,
    pagination: {
      page: currentPage,
      limit: query.limit,
      totalEntries,
      totalPages,
    },
  };
}
