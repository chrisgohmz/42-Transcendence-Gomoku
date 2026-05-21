import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getCurrentSession = mock();
const cancelMatchmakingQueue = mock();
const getMatchmakingQueueStatus = mock();
const joinMatchmakingQueue = mock();

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

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
  test("requires authentication before reading or cancelling queue state", async () => {
    getCurrentSession.mockResolvedValue(null);

    const statusResponse = await route.GET();
    const cancelResponse = await route.DELETE();

    expect(statusResponse.status).toBe(401);
    expect(await statusResponse.json()).toMatchObject({ error: "unauthorized" });
    expect(cancelResponse.status).toBe(401);
    expect(await cancelResponse.json()).toMatchObject({ error: "unauthorized" });
    expect(getMatchmakingQueueStatus).not.toHaveBeenCalled();
    expect(cancelMatchmakingQueue).not.toHaveBeenCalled();
  });

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

  test("returns method-specific server errors when queue operations fail", async () => {
    getMatchmakingQueueStatus.mockRejectedValueOnce(new Error("read failed"));
    joinMatchmakingQueue.mockRejectedValueOnce(new Error("join failed"));
    cancelMatchmakingQueue.mockRejectedValueOnce("cancel failed");

    const statusResponse = await route.GET();
    const joinResponse = await route.POST();
    const cancelResponse = await route.DELETE();

    expect(statusResponse.status).toBe(500);
    expect(await statusResponse.json()).toEqual({
      detail: "read failed",
      error: "failed_to_load_queue_status",
    });
    expect(joinResponse.status).toBe(500);
    expect(await joinResponse.json()).toEqual({
      detail: "join failed",
      error: "failed_to_join_queue",
    });
    expect(cancelResponse.status).toBe(500);
    expect(await cancelResponse.json()).toEqual({
      detail: "Unknown error",
      error: "failed_to_cancel_queue",
    });
  });
});
