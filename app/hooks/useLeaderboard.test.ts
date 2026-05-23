import { describe, expect, test } from "bun:test";

import { getLeaderboardApiPath } from "./useLeaderboard";

describe("getLeaderboardApiPath", () => {
  test("uses the default leaderboard endpoint for all players", () => {
    expect(getLeaderboardApiPath("all")).toBe("/api/leaderboard");
  });

  test("forwards the friends scope to the leaderboard endpoint", () => {
    expect(getLeaderboardApiPath("friends")).toBe("/api/leaderboard?scope=friends");
  });
});
