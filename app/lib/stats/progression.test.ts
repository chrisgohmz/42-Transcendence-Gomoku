import { describe, expect, test } from "bun:test";

import {
  calculateAchievementPoints,
  calculateLevelProgress,
  calculateTotalXp,
} from "./progression";

describe("progression", () => {
  test("sums completed achievement points", () => {
    const points = calculateAchievementPoints([
      { points: 10, completedAt: new Date("2026-05-10T00:00:00.000Z") },
      { points: 5, completedAt: null },
    ]);

    expect(points).toBe(10);
  });

  test("calculates total XP from rating, wins, matches, and points", () => {
    const totalXp = calculateTotalXp({
      rating: 1200,
      wins: 10,
      matchesPlayed: 20,
      achievementPoints: 30,
    });

    expect(totalXp).toBe(1000);
  });

  test("derives level and progress from XP", () => {
    const snapshot = calculateLevelProgress({
      rating: 1000,
      wins: 2,
      matchesPlayed: 5,
      achievementPoints: 0,
    });

    expect(snapshot).toMatchObject({
      level: 1,
      currentXp: 300,
      nextLevelXp: 500,
    });
    expect(snapshot.progress).toBeCloseTo(0.6, 5);
  });
});
