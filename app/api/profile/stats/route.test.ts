import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getCurrentSession = mock();
const getProfileStatsForUser = mock();
const consoleError = mock(() => {});
const originalConsoleError = console.error;

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/stats/profile-stats", () => ({
  getProfileStatsForUser,
}));

const route = await import("./route");

beforeEach(() => {
  getCurrentSession.mockReset();
  getProfileStatsForUser.mockReset();
  consoleError.mockReset();
  console.error = consoleError as unknown as typeof console.error;

  getCurrentSession.mockResolvedValue({
    user: {
      id: "user-ada",
    },
  });
  getProfileStatsForUser.mockResolvedValue({
    userId: "user-ada",
    stats: {
      rating: 1200,
      wins: 3,
      losses: 1,
      draws: 0,
      matchesPlayed: 4,
      winRate: "75.00%",
      currentStreak: 2,
      bestStreak: 2,
      lastPlayedAt: "2026-05-14T09:12:00.000Z",
    },
    rank: 5,
    progression: {
      level: 2,
      progress: 0.25,
      currentXp: 125,
      nextLevelXp: 500,
      totalXp: 625,
      achievementPoints: 20,
    },
    achievements: [
      {
        code: "first_win",
        points: 10,
        progress: 1,
        completedAt: "2026-05-01T00:00:00.000Z",
      },
    ],
    recentMatches: [
      {
        matchId: "match-1",
        opponentDisplayName: "Grace",
        opponentUserId: "user-grace",
        finishedAt: "2026-05-14T09:12:00.000Z",
        result: "WIN",
        endReason: "five_in_a_row",
        moveCount: 42,
      },
    ],
    recentMatchesPagination: {
      page: 1,
      limit: 10,
      totalMatches: 1,
      totalPages: 1,
    },
  });
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("GET /api/profile/stats", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: "unauthorized" });
    expect(getProfileStatsForUser).not.toHaveBeenCalled();
  });

  test("returns profile stats for the current user", async () => {
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getProfileStatsForUser).toHaveBeenCalledWith(
      "user-ada",
      expect.objectContaining({
        recentMatchesLimit: 10,
        recentMatchesPage: 1,
      }),
    );
    expect(payload).toMatchObject({
      userId: "user-ada",
      stats: {
        rating: 1200,
        wins: 3,
        losses: 1,
        draws: 0,
        matchesPlayed: 4,
      },
      rank: 5,
    });
  });

  test("passes bounded pagination params to profile stats", async () => {
    const response = await route.GET(
      new Request("http://localhost/api/profile/stats?page=3&limit=500"),
    );

    expect(response.status).toBe(200);
    expect(getProfileStatsForUser).toHaveBeenCalledWith(
      "user-ada",
      expect.objectContaining({
        recentMatchesLimit: 50,
        recentMatchesPage: 3,
      }),
    );
  });

  test("passes match history advanced search params to profile stats", async () => {
    const response = await route.GET(
      new Request(
        "http://localhost/api/profile/stats?opponent=Grace&result=WIN&matchType=gomoku&dateFrom=2026-05-01&dateTo=2026-05-31&sort=moves_desc&page=2",
      ),
    );

    expect(response.status).toBe(200);
    expect(getProfileStatsForUser).toHaveBeenCalledWith(
      "user-ada",
      expect.objectContaining({
        recentMatchesSearch: expect.objectContaining({
          opponent: "Grace",
          result: "WIN",
          matchType: "gomoku",
          sort: "moves_desc",
          page: 2,
        }),
      }),
    );
  });

  test("falls back for invalid pagination params", async () => {
    const response = await route.GET(
      new Request("http://localhost/api/profile/stats?page=-2&limit=0"),
    );

    expect(response.status).toBe(200);
    expect(getProfileStatsForUser).toHaveBeenCalledWith(
      "user-ada",
      expect.objectContaining({
        recentMatchesLimit: 10,
        recentMatchesPage: 1,
      }),
    );
  });

  test("returns a server error when stats fail to load", async () => {
    getProfileStatsForUser.mockRejectedValueOnce(new Error("boom"));

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "failed_to_load_profile_stats" });
    expect(consoleError).toHaveBeenCalled();
  });
});
