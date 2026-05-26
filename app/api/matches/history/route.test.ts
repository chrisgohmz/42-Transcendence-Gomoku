import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getCurrentSession = mock();
const getMatchHistoryPageForUser = mock();

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/matches/match-history", () => ({
  MATCH_HISTORY_MAX_LIMIT: 100,
  getMatchHistoryPageForUser,
  normalizeMatchHistoryLimit: (limit: number | null | undefined) => limit ?? 20,
}));

const route = await import("./route");

function request(limit?: string) {
  const url = new URL("http://localhost/api/matches/history");
  if (limit !== undefined) {
    url.searchParams.set("limit", limit);
  }

  return new Request(url);
}

beforeEach(() => {
  getCurrentSession.mockReset();
  getMatchHistoryPageForUser.mockReset();

  getCurrentSession.mockResolvedValue({
    user: {
      id: "user-ada",
    },
  });
  getMatchHistoryPageForUser.mockResolvedValue({
    entries: [
      {
        matchId: "match-1",
        opponentUserIds: ["user-grace"],
      },
    ],
    limit: 5,
    page: 1,
    totalMatches: 1,
    totalPages: 1,
  });
});

describe("GET /api/matches/history", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: "unauthorized" });
    expect(getMatchHistoryPageForUser).not.toHaveBeenCalled();
  });

  test("loads bounded history for the current user", async () => {
    const response = await route.GET(request("5"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getMatchHistoryPageForUser).toHaveBeenCalledWith(
      "user-ada",
      1,
      5,
      expect.objectContaining({
        limit: 5,
        page: 1,
      }),
    );
    expect(payload).toEqual({
      count: 1,
      limit: 5,
      matches: [
        {
          matchId: "match-1",
          opponentUserIds: ["user-grace"],
        },
      ],
      page: 1,
      totalMatches: 1,
      totalPages: 1,
    });
  });

  test("uses the default history limit when omitted", async () => {
    getMatchHistoryPageForUser.mockResolvedValueOnce({
      entries: [],
      limit: 20,
      page: 1,
      totalMatches: 0,
      totalPages: 1,
    });

    const response = await route.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getMatchHistoryPageForUser).toHaveBeenCalledWith(
      "user-ada",
      1,
      20,
      expect.objectContaining({
        limit: 20,
        page: 1,
      }),
    );
    expect(payload["limit"]).toBe(20);
  });

  test("rejects invalid limits before querying", async () => {
    const response = await route.GET(request("101"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "invalid_limit" });
    expect(getMatchHistoryPageForUser).not.toHaveBeenCalled();
  });
});
