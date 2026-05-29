import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

await mock.module("server-only", () => ({}));

const getCurrentSession = mock();
const findParticipant = mock();
const findConversation = mock();
const findFriendship = mock();
const updateParticipant = mock();

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/prisma", () => ({
  prisma: {
    conversation: {
      findUnique: findConversation,
    },
    conversationParticipant: {
      findUnique: findParticipant,
      update: updateParticipant,
    },
    friendship: {
      findUnique: findFriendship,
    },
  },
}));

const route = await import("./route");

function params(id = "conv-1") {
  return { params: Promise.resolve({ id }) };
}

function directConversation() {
  return {
    kind: "DIRECT",
    participants: [{ userId: "user-bob" }],
  };
}

beforeEach(() => {
  getCurrentSession.mockReset();
  findParticipant.mockReset();
  findConversation.mockReset();
  findFriendship.mockReset();
  updateParticipant.mockReset();

  getCurrentSession.mockResolvedValue({
    user: { id: "user-alice", username: "alice", displayName: "Alice" },
  });
  findParticipant.mockResolvedValue({ id: "participation-1" });
  findConversation.mockResolvedValue(directConversation());
  findFriendship.mockResolvedValue({ status: "ACCEPTED" });
  updateParticipant.mockResolvedValue({});
});

describe("POST /api/conversations/[id]/read", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.POST(new Request("http://localhost"), params());

    expect(response.status).toBe(401);
    expect(findParticipant).not.toHaveBeenCalled();
    expect(updateParticipant).not.toHaveBeenCalled();
  });

  test("returns 404 when user is not a participant", async () => {
    findParticipant.mockResolvedValueOnce(null);

    const response = await route.POST(new Request("http://localhost"), params());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "conversation_not_found" });
    expect(updateParticipant).not.toHaveBeenCalled();
  });

  test("denies marking read after unfriending", async () => {
    findFriendship.mockResolvedValueOnce({ status: "DECLINED" });

    const response = await route.POST(new Request("http://localhost"), params());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "not_friends" });
    expect(updateParticipant).not.toHaveBeenCalled();
  });

  test("marks the active conversation as read", async () => {
    const response = await route.POST(new Request("http://localhost"), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ lastReadAt: expect.any(String) });
    expect(updateParticipant).toHaveBeenCalledWith({
      where: {
        conversationId_userId: { conversationId: "conv-1", userId: "user-alice" },
      },
      data: { lastReadAt: expect.any(Date) },
    });
  });

  test("returns 500 when read-state update fails", async () => {
    updateParticipant.mockRejectedValueOnce(new Error("db down"));

    const response = await route.POST(new Request("http://localhost"), params());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "failed_to_mark_conversation_read",
    });
  });
});
