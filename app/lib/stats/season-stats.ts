import { MatchStatus, Role } from "../../../generated/prisma/enums";
import { prisma } from "../prisma";
import { getCurrentSeason, type SeasonInfo } from "../seasons/current-season";

export type SeasonSnapshot = {
  season: SeasonInfo;
  daysLeft: number;
  ratedMatchCount: number;
};

type SeasonMatchCountClient = Pick<typeof prisma, "match">;

function buildRatedMatchWhere(season: SeasonInfo) {
  return {
    status: MatchStatus.FINISHED,
    finishedAt: {
      gte: season.start,
      lt: season.end,
    },
    participants: {
      some: {
        role: Role.PLAYER,
        userId: {
          not: null,
        },
      },
      none: {
        role: Role.PLAYER,
        userId: null,
      },
    },
  };
}

// Rated matches are counted per game, not per participant, and only for finished human-vs-human games.
async function countSeasonRatedMatches(
  season: SeasonInfo,
  client: SeasonMatchCountClient = prisma,
): Promise<number> {
  return client.match.count({
    where: buildRatedMatchWhere(season),
  });
}

export async function getSeasonRatedMatchCount(now: Date = new Date()): Promise<number> {
  const season = getCurrentSeason(now);
  return countSeasonRatedMatches(season);
}

export async function getSeasonSnapshot(now: Date = new Date()): Promise<SeasonSnapshot> {
  const season = getCurrentSeason(now);
  const ratedMatchCount = await countSeasonRatedMatches(season);

  return {
    season,
    daysLeft: season.daysLeft,
    ratedMatchCount,
  };
}
