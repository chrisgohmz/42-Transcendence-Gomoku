const UTC_DAY_MS = 24 * 60 * 60 * 1000;

export type SeasonInfo = {
  season: number;
  year: number;
  start: Date;
  end: Date;
  daysLeft: number;
};

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

function getSeasonStart(now: Date): { season: number; year: number; start: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (month >= 2 && month < 5) {
    return { season: 1, year, start: createUtcDate(year, 2, 1) };
  }

  if (month >= 5 && month < 8) {
    return { season: 2, year, start: createUtcDate(year, 5, 1) };
  }

  if (month >= 8 && month < 11) {
    return { season: 3, year, start: createUtcDate(year, 8, 1) };
  }

  if (month === 11) {
    return { season: 4, year, start: createUtcDate(year, 11, 1) };
  }

  return { season: 4, year: year - 1, start: createUtcDate(year - 1, 11, 1) };
}

// Season boundaries are anchored to UTC month starts so local time zones do not shift the range.
export function getCurrentSeason(now: Date = new Date()): SeasonInfo {
  const seasonStart = getSeasonStart(now);
  const end = new Date(
    Date.UTC(
      seasonStart.start.getUTCFullYear(),
      seasonStart.start.getUTCMonth() + 3,
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / UTC_DAY_MS));

  return {
    season: seasonStart.season,
    year: seasonStart.year,
    start: seasonStart.start,
    end,
    daysLeft,
  };
}
