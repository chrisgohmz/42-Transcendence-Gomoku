import { describe, expect, mock, test } from "bun:test";

const matchCount = mock(async (_args: unknown) => 7);

await mock.module("../prisma", () => ({
  prisma: {
    match: {
      count: matchCount,
    },
  },
}));

const { getSeasonRatedMatchCount, getSeasonSnapshot } = await import("./season-stats");

describe("season stats", () => {
  test("counts only finished human matches within the current season range", async () => {
    const now = new Date("2026-05-21T12:00:00.000Z");

    const count = await getSeasonRatedMatchCount(now);

    expect(count).toBe(7);
    expect(matchCount).toHaveBeenCalledTimes(1);
    expect(matchCount.mock.calls[0]?.[0]).toMatchObject({
      where: {
        status: "FINISHED",
        finishedAt: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-06-01T00:00:00.000Z"),
        },
        participants: {
          some: {
            role: "PLAYER",
            userId: {
              not: null,
            },
          },
          none: {
            role: "PLAYER",
            userId: null,
          },
        },
      },
    });
  });

  test("returns a season snapshot with days left and rated match count", async () => {
    const snapshot = await getSeasonSnapshot(new Date("2026-05-21T12:00:00.000Z"));

    expect(snapshot.daysLeft).toBe(11);
    expect(snapshot.ratedMatchCount).toBe(7);
    expect(snapshot.season).toMatchObject({
      season: 1,
      year: 2026,
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-06-01T00:00:00.000Z"),
    });
  });
});
