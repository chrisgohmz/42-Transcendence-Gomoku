import { beforeEach, describe, expect, mock, test } from "bun:test";

const findMany = mock();
const findUnique = mock();

await mock.module("./prisma", () => ({
  prisma: {
    userGameStats: {
      findMany,
      findUnique,
    },
  },
}));

const { parseLeaderboardSearchParams } = await import("./advanced-search");
const { LEADERBOARD_FETCH_LIMIT, getLeaderboardSearchSnapshot } = await import("./leaderboard");

beforeEach(() => {
  findMany.mockReset();
  findUnique.mockReset();
});

describe("getLeaderboardSearchSnapshot", () => {
  test("counts eligibility separately and fetches a bounded ordered page for rank sorting", async () => {
    findMany
      .mockResolvedValueOnce([
        { botMatchesPlayed: 0, matchesPlayed: 3 },
        { botMatchesPlayed: 2, matchesPlayed: 2 },
        { botMatchesPlayed: 1, matchesPlayed: 4 },
      ])
      .mockResolvedValueOnce([
        {
          botMatchesPlayed: 0,
          losses: 1,
          matchesPlayed: 3,
          rating: 1700,
          userId: "user-ada",
          wins: 2,
          user: { displayName: "Ada" },
        },
        {
          botMatchesPlayed: 2,
          losses: 0,
          matchesPlayed: 2,
          rating: 1600,
          userId: "bot-only",
          wins: 2,
          user: { displayName: "Bot Only" },
        },
        {
          botMatchesPlayed: 1,
          losses: 1,
          matchesPlayed: 4,
          rating: 1500,
          userId: "user-grace",
          wins: 3,
          user: { displayName: "Grace" },
        },
      ]);

    const snapshot = await getLeaderboardSearchSnapshot(null, {
      q: "a",
      scope: "all",
      band: "all",
      minRating: null,
      maxRating: null,
      minMatches: null,
      sort: "rank",
      page: 1,
      limit: 2,
    });

    expect(snapshot.pagination).toEqual({
      page: 1,
      limit: 2,
      totalEntries: 2,
      totalPages: 1,
    });
    expect(snapshot.entries.map((entry) => entry.playerId)).toEqual(["user-ada", "user-grace"]);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      select: {
        botMatchesPlayed: true,
        matchesPlayed: true,
      },
    });
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("take");
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      orderBy: [{ rating: "desc" }, { wins: "desc" }, { losses: "asc" }],
      skip: 0,
      take: LEADERBOARD_FETCH_LIMIT,
    });
  });

  test("pushes supported non-default sort order into the page query", async () => {
    findMany.mockResolvedValueOnce([{ botMatchesPlayed: 0, matchesPlayed: 3 }]);
    findMany.mockResolvedValueOnce([
      {
        botMatchesPlayed: 0,
        losses: 1,
        matchesPlayed: 3,
        rating: 1700,
        userId: "user-ada",
        wins: 2,
        user: { displayName: "Ada" },
      },
    ]);

    await getLeaderboardSearchSnapshot(null, {
      q: "",
      scope: "all",
      band: "all",
      minRating: null,
      maxRating: null,
      minMatches: null,
      sort: "matches_desc",
      page: 1,
      limit: 10,
    });

    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      orderBy: [{ matchesPlayed: "desc" }, { rating: "desc" }, { wins: "desc" }],
      skip: 0,
      take: LEADERBOARD_FETCH_LIMIT,
    });
  });

  test("normalizes deferred win-rate sorting to the bounded rank query path", async () => {
    findMany.mockResolvedValueOnce([{ botMatchesPlayed: 0, matchesPlayed: 3 }]);
    findMany.mockResolvedValueOnce([
      {
        botMatchesPlayed: 0,
        losses: 1,
        matchesPlayed: 3,
        rating: 1700,
        userId: "user-ada",
        wins: 2,
        user: { displayName: "Ada" },
      },
    ]);

    const query = parseLeaderboardSearchParams(new URLSearchParams({ sort: "win_rate_desc" }));

    await getLeaderboardSearchSnapshot(null, query);

    expect(query.sort).toBe("rank");
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      orderBy: [{ rating: "desc" }, { wins: "desc" }, { losses: "asc" }],
      skip: 0,
      take: LEADERBOARD_FETCH_LIMIT,
    });
  });
});
