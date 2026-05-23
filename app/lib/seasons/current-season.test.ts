import { describe, expect, test } from "bun:test";

import { getCurrentSeason } from "./current-season";

describe("getCurrentSeason", () => {
  test("returns spring season boundaries in UTC", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");

    expect(getCurrentSeason(now)).toMatchObject({
      season: 1,
      year: 2026,
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-06-01T00:00:00.000Z"),
      daysLeft: 92,
    });
  });

  test("maps january to the previous winter season", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const season = getCurrentSeason(now);

    expect(season.season).toBe(4);
    expect(season.year).toBe(2025);
    expect(season.start.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(season.end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(season.daysLeft).toBe(45);
  });
});
