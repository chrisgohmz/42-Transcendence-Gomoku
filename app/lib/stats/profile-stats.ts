import type { Prisma } from "../../../generated/prisma/client";
import { MatchResult, Role } from "../../../generated/prisma/enums";
import {
  LEADERBOARD_BOARD_SIZE,
  LEADERBOARD_RULE_TYPE,
  buildLeaderboardAheadWhere,
  formatWinRate,
  type LeaderboardRankInput,
} from "../leaderboard";
import { getMatchHistoryForUser, type MatchHistoryEntry } from "../matches/match-history";
import { prisma } from "../prisma";
import { calculateAchievementPoints, calculateLevelProgress } from "./progression";

export const PROFILE_RECENT_MATCHES_LIMIT = 20;

export type ProfileRecentMatch = {
  matchId: string;
  opponentDisplayName: string | null;
  opponentUserId: string | null;
  finishedAt: string | null;
  result: MatchResult | null;
  endReason: string | null;
  moveCount: number;
};

export type ProfileStatsSnapshot = {
  userId: string;
  stats: {
    rating: number | null;
    wins: number;
    losses: number;
    draws: number;
    matchesPlayed: number;
    winRate: string;
    currentStreak: number;
    bestStreak: number;
    lastPlayedAt: string | null;
  };
  rank: number | null;
  progression: {
    level: number;
    progress: number;
    currentXp: number;
    nextLevelXp: number;
    totalXp: number;
    achievementPoints: number;
  };
  achievements: Array<{
    code: string;
    points: number;
    progress: number;
    completedAt: string | null;
  }>;
  recentMatches: ProfileRecentMatch[];
};

const statsSelect = {
  rating: true,
  wins: true,
  losses: true,
  draws: true,
  matchesPlayed: true,
  currentStreak: true,
  bestStreak: true,
  lastPlayedAt: true,
} satisfies Prisma.UserGameStatsSelect;

function getOpponent(entry: MatchHistoryEntry, currentUserId: string) {
  const opponents = entry.participants.filter(
    (participant) => participant.role === Role.PLAYER && participant.userId !== currentUserId,
  );

  const opponent =
    opponents.find((participant) => participant.userId !== null) ?? opponents[0] ?? null;

  return opponent
    ? {
        displayName: opponent.displayName,
        userId: opponent.userId,
      }
    : {
        displayName: null,
        userId: null,
      };
}

function toRecentMatch(entry: MatchHistoryEntry, currentUserId: string): ProfileRecentMatch {
  const opponent = getOpponent(entry, currentUserId);

  return {
    matchId: entry.matchId,
    opponentDisplayName: opponent.displayName,
    opponentUserId: opponent.userId,
    finishedAt: entry.finishedAt,
    result: entry.result,
    endReason: entry.endReason,
    moveCount: entry.moveCount,
  };
}

async function getRankForUser(stats: LeaderboardRankInput | null): Promise<number | null> {
  if (!stats) {
    return null;
  }

  const aheadWhere = buildLeaderboardAheadWhere(stats);
  if (!aheadWhere) {
    return null;
  }

  const aheadCount = await prisma.userGameStats.count({
    where: aheadWhere,
  });

  return aheadCount + 1;
}

export async function getProfileStatsForUser(userId: string): Promise<ProfileStatsSnapshot> {
  const [statsRow, achievementRows, matchHistory] = await Promise.all([
    prisma.userGameStats.findUnique({
      where: {
        userId_ruleType_boardSize: {
          userId,
          ruleType: LEADERBOARD_RULE_TYPE,
          boardSize: LEADERBOARD_BOARD_SIZE,
        },
      },
      select: statsSelect,
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: {
          select: {
            code: true,
            points: true,
          },
        },
      },
    }),
    getMatchHistoryForUser(userId, PROFILE_RECENT_MATCHES_LIMIT),
  ]);

  const stats = {
    rating: statsRow?.rating ?? null,
    wins: statsRow?.wins ?? 0,
    losses: statsRow?.losses ?? 0,
    draws: statsRow?.draws ?? 0,
    matchesPlayed: statsRow?.matchesPlayed ?? 0,
    winRate: formatWinRate(statsRow?.wins ?? 0, statsRow?.matchesPlayed ?? 0),
    currentStreak: statsRow?.currentStreak ?? 0,
    bestStreak: statsRow?.bestStreak ?? 0,
    lastPlayedAt: statsRow?.lastPlayedAt ? statsRow.lastPlayedAt.toISOString() : null,
  };

  const achievementInputs = achievementRows.map((row) => ({
    points: row.achievement.points,
    completedAt: row.completedAt,
  }));
  const achievementPoints = calculateAchievementPoints(achievementInputs);
  const progression = calculateLevelProgress({
    rating: stats.rating,
    wins: stats.wins,
    matchesPlayed: stats.matchesPlayed,
    achievementPoints,
  });

  const rank = await getRankForUser({
    rating: stats.rating,
    wins: stats.wins,
    losses: stats.losses,
    matchesPlayed: stats.matchesPlayed,
  });

  return {
    userId,
    stats,
    rank,
    progression: {
      ...progression,
      achievementPoints,
    },
    achievements: achievementRows.map((row) => ({
      code: row.achievement.code,
      points: row.achievement.points,
      progress: row.progress,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    })),
    recentMatches: matchHistory.map((entry) => toRecentMatch(entry, userId)),
  };
}
