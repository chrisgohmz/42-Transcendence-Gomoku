import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "./prisma";

export const LEADERBOARD_BOARD_SIZE = 15;
export const LEADERBOARD_LIMIT = 100;

type LeaderboardStat = {
  matchesPlayed: number;
  rating: number | null;
  userId: string;
  wins: number;
  losses: number;
  user: {
    displayName: string;
  };
};

export type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: string;
};

export const leaderboardQueryArgs = {
  orderBy: [{ rating: "desc" }, { wins: "desc" }, { losses: "asc" }],
  select: {
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
  },
  take: LEADERBOARD_LIMIT,
  where: {
    boardSize: LEADERBOARD_BOARD_SIZE,
    ruleType: "GOMOKU",
  },
} satisfies Prisma.UserGameStatsFindManyArgs;

export function formatWinRate(wins: number, matchesPlayed: number): string {
  if (matchesPlayed === 0) {
    return "0.00%";
  }

  return `${((wins / matchesPlayed) * 100).toFixed(2)}%`;
}

export function toLeaderboardEntries(stats: LeaderboardStat[]): LeaderboardEntry[] {
  return stats.map((stat, index) => ({
    playerId: stat.userId,
    rank: index + 1,
    player: stat.user.displayName,
    rating: stat.rating ?? 0,
    wins: stat.wins,
    losses: stat.losses,
    winRate: formatWinRate(stat.wins, stat.matchesPlayed),
  }));
}

export async function getLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  const stats = await prisma.userGameStats.findMany(leaderboardQueryArgs);

  return toLeaderboardEntries(stats);
}
