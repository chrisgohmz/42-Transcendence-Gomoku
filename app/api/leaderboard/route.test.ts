import { beforeEach, describe, expect, mock, test } from "bun:test";

const getCurrentSession = mock();
const getLeaderboardSnapshot = mock();

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/leaderboard", () => ({
  getLeaderboardSnapshot,
}));

const route = await import("./route");

beforeEach(() => {
  getCurrentSession.mockReset();
  getLeaderboardSnapshot.mockReset();

  getCurrentSession.mockResolvedValue({
    user: {
      id: "user-ada",
    },
  });

  getLeaderboardSnapshot.mockResolvedValue({
    entries: [
      {
        playerId: "user-ada",
        rank: 1,
        player: "Ada",
        rating: 1200,
        wins: 3,
        losses: 1,
        winRate: "75.00%",
      },
    ],
    currentUser: {
      playerId: "user-ada",
      rank: 1,
      player: "Ada",
      rating: 1200,
      wins: 3,
      losses: 1,
      winRate: "75.00%",
    },
  });
});

describe("GET /api/leaderboard", () => {
  test("returns the leaderboard snapshot for signed-in users", async () => {
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getLeaderboardSnapshot).toHaveBeenCalledWith("user-ada");
    expect(payload).toMatchObject({
      entries: [{ playerId: "user-ada", rank: 1 }],
      currentUser: { playerId: "user-ada", rank: 1 },
    });
  });

  test("allows anonymous access", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getLeaderboardSnapshot).toHaveBeenCalledWith(null);
    expect(payload).toMatchObject({
      entries: [{ playerId: "user-ada", rank: 1 }],
    });
  });

  test("returns a server error when snapshot fails to load", async () => {
    getLeaderboardSnapshot.mockRejectedValueOnce(new Error("boom"));

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: "failed_to_load_leaderboard" });
  });
});
