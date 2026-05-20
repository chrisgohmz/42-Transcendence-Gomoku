//import { cacheLife } from "next/cache";

import { prisma } from "@/lib/prisma";

import type { Prisma } from "../../generated/prisma/client";
import { RuleType } from "../../generated/prisma/enums";

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

export type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: string;
};

export type LeaderboardSnapshot = {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
};

export type LeaderboardRankInput = {
  rating: number | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
  botMatchesPlayed: number;
};

export const leaderboardQueryArgs = {
  orderBy: [{ rating: "desc" }, { wins: "desc" }, { losses: "asc" }],
  select: leaderboardSelect,
  take: LEADERBOARD_FETCH_LIMIT,
  where: {
    boardSize: LEADERBOARD_BOARD_SIZE,
    ruleType: LEADERBOARD_RULE_TYPE,
    matchesPlayed: { gt: 0 },
  },
} satisfies Prisma.UserGameStatsFindManyArgs;

export function formatWinRate(wins: number, matchesPlayed: number): string {
  if (matchesPlayed === 0) {
    return "0.00%";
  }

  return `${((wins / matchesPlayed) * 100).toFixed(2)}%`;
}

function isLeaderboardEligible(stat: LeaderboardStat): boolean {
  return stat.matchesPlayed > stat.botMatchesPlayed;
}

function toLeaderboardEntry(stat: LeaderboardStat, rank: number): LeaderboardEntry {
  return {
    playerId: stat.userId,
    rank,
    player: stat.user.displayName,
    rating: stat.rating ?? 0,
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

export async function getLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  //  "use cache";
  //  cacheLife("minutes");

  const stats = await prisma.userGameStats.findMany(leaderboardQueryArgs);

  return toLeaderboardEntries(stats).slice(0, LEADERBOARD_LIMIT);
}

export async function getLeaderboardRank(input: LeaderboardRankInput): Promise<number | null> {
  if (input.matchesPlayed === 0 || input.matchesPlayed <= input.botMatchesPlayed) {
    return null;
  }

  if (input.rating === null) {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS "count"
      FROM "UserGameStats"
      WHERE "boardSize" = ${LEADERBOARD_BOARD_SIZE}
        AND "ruleType" = ${LEADERBOARD_RULE_TYPE}
        AND "matchesPlayed" > 0
        AND "matchesPlayed" > "botMatchesPlayed"
        AND (
          "rating" IS NOT NULL
          OR (
            "rating" IS NULL
            AND ("wins" > ${input.wins} OR ("wins" = ${input.wins} AND "losses" < ${input.losses}))
          )
        )
    `;
    const aheadCount = rows[0]?.count ?? 0;
    return aheadCount + 1;
  }

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS "count"
    FROM "UserGameStats"
    WHERE "boardSize" = ${LEADERBOARD_BOARD_SIZE}
      AND "ruleType" = ${LEADERBOARD_RULE_TYPE}
      AND "matchesPlayed" > 0
      AND "matchesPlayed" > "botMatchesPlayed"
      AND (
        "rating" > ${input.rating}
        OR (
          "rating" = ${input.rating}
          AND ("wins" > ${input.wins} OR ("wins" = ${input.wins} AND "losses" < ${input.losses}))
        )
      )
  `;
  const aheadCount = rows[0]?.count ?? 0;
  return aheadCount + 1;
}

export async function getLeaderboardSpotlight(userId: string): Promise<LeaderboardEntry | null> {
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

  const rank = await getLeaderboardRank({
    rating: stats.rating,
    wins: stats.wins,
    losses: stats.losses,
    matchesPlayed: stats.matchesPlayed,
    botMatchesPlayed: stats.botMatchesPlayed,
  });

  return rank === null ? null : toLeaderboardEntry(stats, rank);
}

export async function getLeaderboardSnapshot(userId: string | null): Promise<LeaderboardSnapshot> {
  const [entries, currentUser] = await Promise.all([
    getLeaderboardEntries(),
    userId ? getLeaderboardSpotlight(userId) : Promise.resolve(null),
  ]);

  return { entries, currentUser };
}
