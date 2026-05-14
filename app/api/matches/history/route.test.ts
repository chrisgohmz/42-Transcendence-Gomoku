import { beforeEach, describe, expect, mock, test } from "bun:test";

const getCurrentSession = mock();
const getMatchHistoryForUser = mock();

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/matches/match-history", () => ({
  MATCH_HISTORY_MAX_LIMIT: 100,
  getMatchHistoryForUser,
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
  getMatchHistoryForUser.mockReset();

  getCurrentSession.mockResolvedValue({
    user: {
      id: "user-ada",
    },
  });
  getMatchHistoryForUser.mockResolvedValue([
    {
      matchId: "match-1",
      opponentUserIds: ["user-grace"],
    },
  ]);
});

describe("GET /api/matches/history", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: "unauthorized" });
    expect(getMatchHistoryForUser).not.toHaveBeenCalled();
  });

  test("loads bounded history for the current user", async () => {
    const response = await route.GET(request("5"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getMatchHistoryForUser).toHaveBeenCalledWith("user-ada", 5);
    expect(payload).toEqual({
      count: 1,
      limit: 5,
      matches: [
        {
          matchId: "match-1",
          opponentUserIds: ["user-grace"],
        },
      ],
    });
  });

  test("uses the default history limit when omitted", async () => {
    const response = await route.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getMatchHistoryForUser).toHaveBeenCalledWith("user-ada", 20);
    expect(payload["limit"]).toBe(20);
  });

  test("rejects invalid limits before querying", async () => {
    const response = await route.GET(request("101"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "invalid_limit" });
    expect(getMatchHistoryForUser).not.toHaveBeenCalled();
  });
});
