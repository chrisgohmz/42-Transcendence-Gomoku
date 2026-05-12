import { beforeEach, describe, expect, mock, test } from "bun:test";

const getCurrentSession = mock();
const cancelMatchmakingQueue = mock();
const getMatchmakingQueueStatus = mock();
const joinMatchmakingQueue = mock();

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/matches/matchmaking", () => ({
  cancelMatchmakingQueue,
  getMatchmakingQueueStatus,
  joinMatchmakingQueue,
}));

const route = await import("./route");

const user = {
  displayName: "Ada",
  id: "user-ada",
  username: "ada",
};

beforeEach(() => {
  getCurrentSession.mockReset();
  cancelMatchmakingQueue.mockReset();
  getMatchmakingQueueStatus.mockReset();
  joinMatchmakingQueue.mockReset();

  getCurrentSession.mockResolvedValue({
    user,
  });
});

describe("/api/matches/queue", () => {
  test("requires authentication before queueing", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.POST();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      error: "unauthorized",
    });
    expect(joinMatchmakingQueue).not.toHaveBeenCalled();
  });

  test("joins the queue for the authenticated user", async () => {
    joinMatchmakingQueue.mockResolvedValueOnce({
      kind: "queued",
      queuePosition: 1,
    });

    const response = await route.POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      kind: "queued",
      queuePosition: 1,
    });
    expect(joinMatchmakingQueue).toHaveBeenCalledWith(user);
  });

  test("loads and cancels the authenticated user's queue state", async () => {
    getMatchmakingQueueStatus.mockResolvedValueOnce({ kind: "not_queued" });
    cancelMatchmakingQueue.mockResolvedValueOnce({ kind: "not_queued" });

    const statusResponse = await route.GET();
    const cancelResponse = await route.DELETE();

    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toEqual({ kind: "not_queued" });
    expect(cancelResponse.status).toBe(200);
    expect(await cancelResponse.json()).toEqual({ kind: "not_queued" });
    expect(getMatchmakingQueueStatus).toHaveBeenCalledWith(user);
    expect(cancelMatchmakingQueue).toHaveBeenCalledWith(user);
  });
});
