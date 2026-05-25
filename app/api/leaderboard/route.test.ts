import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getCurrentSessionIdentity = mock();
const getLeaderboardSearchSnapshot = mock();

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSessionIdentity,
  }),
);

await mock.module("@/lib/leaderboard", () => ({
  getLeaderboardSearchSnapshot,
}));

const route = await import("./route");

function request(path = "http://localhost/api/leaderboard") {
  return new Request(path);
}

beforeEach(() => {
  getCurrentSessionIdentity.mockReset();
  getLeaderboardSearchSnapshot.mockReset();

  getCurrentSessionIdentity.mockResolvedValue({
    user: {
      id: "user-ada",
    },
  });

  getLeaderboardSearchSnapshot.mockResolvedValue({
    entries: [
      {
        playerId: "user-ada",
        rank: 1,
        player: "Ada",
        rating: 1200,
        matchesPlayed: 4,
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
      matchesPlayed: 4,
      wins: 3,
      losses: 1,
      winRate: "75.00%",
    },
  });
});

describe("GET /api/leaderboard", () => {
  test("returns the leaderboard snapshot for signed-in users", async () => {
    const response = await route.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getLeaderboardSearchSnapshot).toHaveBeenCalledWith(
      "user-ada",
      expect.objectContaining({ scope: "all" }),
    );
    expect(payload).toMatchObject({
      entries: [{ playerId: "user-ada", rank: 1 }],
      currentUser: { playerId: "user-ada", rank: 1 },
    });
  });

  test("allows anonymous access", async () => {
    getCurrentSessionIdentity.mockResolvedValueOnce(null);

    const response = await route.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getLeaderboardSearchSnapshot).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ scope: "all" }),
    );
    expect(payload).toMatchObject({
      entries: [{ playerId: "user-ada", rank: 1 }],
    });
  });

  test("passes friends scope from the request query", async () => {
    const response = await route.GET(request("http://localhost/api/leaderboard?scope=friends"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getLeaderboardSearchSnapshot).toHaveBeenCalledWith(
      "user-ada",
      expect.objectContaining({ scope: "friends" }),
    );
    expect(payload).toMatchObject({
      entries: [{ playerId: "user-ada", rank: 1 }],
    });
  });

  test("returns a server error when snapshot fails to load", async () => {
    getLeaderboardSearchSnapshot.mockRejectedValueOnce(new Error("boom"));

    const response = await route.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: "failed_to_load_leaderboard" });
  });
});
