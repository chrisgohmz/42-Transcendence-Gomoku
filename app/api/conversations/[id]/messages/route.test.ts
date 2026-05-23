import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

await mock.module("server-only", () => ({}));

const getCurrentSession = mock();
const findParticipant = mock();
const findConversation = mock();
const findFriendship = mock();
const findMessages = mock();
const updateParticipant = mock();
const createMessage = mock();
const updateConversation = mock();
const transaction = mock();
const publishChatMessage = mock();

const txClient = {
  conversation: { update: updateConversation },
  directMessage: { create: createMessage },
};

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
    directMessage: {
      findMany: findMessages,
    },
    friendship: {
      findUnique: findFriendship,
    },
    $transaction: transaction,
  },
}));

await mock.module("@/lib/chat/realtime-publisher", () => ({
  publishChatMessage,
}));

const route = await import("./route");

const createdAt = new Date("2026-05-12T10:00:00.000Z");
const createdAtIso = createdAt.toISOString();

function params(id = "conv-1") {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/conversations/conv-1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  findMessages.mockReset();
  updateParticipant.mockReset();
  createMessage.mockReset();
  updateConversation.mockReset();
  transaction.mockReset();
  publishChatMessage.mockReset();

  getCurrentSession.mockResolvedValue({
    user: { id: "user-alice", username: "alice", displayName: "Alice" },
  });
  findParticipant.mockResolvedValue({ id: "participation-1" });
  findConversation.mockResolvedValue(directConversation());
  findFriendship.mockResolvedValue({ status: "ACCEPTED" });
  findMessages.mockResolvedValue([]);
  updateParticipant.mockResolvedValue({});
  transaction.mockImplementation(async (callback: (client: typeof txClient) => unknown) =>
    callback(txClient),
  );
  publishChatMessage.mockResolvedValue(undefined);
});

describe("GET /api/conversations/[id]/messages", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.GET(new Request("http://localhost"), params());

    expect(response.status).toBe(401);
    expect(findParticipant).not.toHaveBeenCalled();
  });

  test("returns 404 when user is not a participant", async () => {
    findParticipant.mockResolvedValueOnce(null);

    const response = await route.GET(new Request("http://localhost"), params());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "conversation_not_found" });
    expect(findMessages).not.toHaveBeenCalled();
  });

  test("denies access after unfriending", async () => {
    findFriendship.mockResolvedValueOnce({ status: "DECLINED" });

    const response = await route.GET(new Request("http://localhost"), params());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "not_friends" });
    expect(findMessages).not.toHaveBeenCalled();
  });

  test("denies access when friendship row is missing", async () => {
    findFriendship.mockResolvedValueOnce(null);

    const response = await route.GET(new Request("http://localhost"), params());

    expect(response.status).toBe(403);
    expect(findMessages).not.toHaveBeenCalled();
  });

  test("returns messages and marks the conversation as read", async () => {
    const message = {
      id: "msg-1",
      body: "hello",
      createdAt,
      sender: {
        id: "user-bob",
        username: "bob",
        displayName: "Bob",
        avatarUrl: null,
      },
    };
    findMessages.mockResolvedValueOnce([message]);

    const response = await route.GET(new Request("http://localhost"), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      messages: [{ ...message, createdAt: createdAtIso }],
    });
    expect(updateParticipant).toHaveBeenCalledWith({
      where: {
        conversationId_userId: { conversationId: "conv-1", userId: "user-alice" },
      },
      data: { lastReadAt: expect.any(Date) },
    });
  });
});

describe("POST /api/conversations/[id]/messages", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.POST(postRequest({ body: "hi" }), params());

    expect(response.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  test("returns 404 when user is not a participant", async () => {
    findParticipant.mockResolvedValueOnce(null);

    const response = await route.POST(postRequest({ body: "hi" }), params());

    expect(response.status).toBe(404);
    expect(transaction).not.toHaveBeenCalled();
  });

  test("blocks sending after unfriending", async () => {
    findFriendship.mockResolvedValueOnce({ status: "DECLINED" });

    const response = await route.POST(postRequest({ body: "hi" }), params());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "not_friends" });
    expect(transaction).not.toHaveBeenCalled();
    expect(publishChatMessage).not.toHaveBeenCalled();
  });

  test("rejects empty and oversize bodies", async () => {
    const emptyResponse = await route.POST(postRequest({ body: "   " }), params());
    expect(emptyResponse.status).toBe(400);

    const longResponse = await route.POST(postRequest({ body: "x".repeat(2001) }), params());
    expect(longResponse.status).toBe(400);

    expect(transaction).not.toHaveBeenCalled();
  });

  test("persists message and bumps lastMessageAt in a single transaction", async () => {
    const created = {
      id: "msg-1",
      body: "hello",
      createdAt,
      sender: {
        id: "user-alice",
        username: "alice",
        displayName: "Alice",
        avatarUrl: null,
      },
    };
    createMessage.mockResolvedValueOnce(created);
    updateConversation.mockResolvedValueOnce({});

    const response = await route.POST(postRequest({ body: "hello" }), params());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      message: { ...created, createdAt: createdAtIso },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: "conv-1",
          senderUserId: "user-alice",
          kind: "USER",
          body: "hello",
        }),
      }),
    );
    expect(updateConversation).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { lastMessageAt: created.createdAt },
    });
    expect(publishChatMessage).toHaveBeenCalledWith({
      conversationId: "conv-1",
      message: created,
    });
  });

  test("returns 500 on transaction failure without calling realtime", async () => {
    transaction.mockRejectedValueOnce(new Error("db down"));

    const response = await route.POST(postRequest({ body: "hello" }), params());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "failed_to_send_message" });
    expect(publishChatMessage).not.toHaveBeenCalled();
  });

  test("still returns the committed message when realtime publish fails", async () => {
    const created = {
      id: "msg-2",
      body: "world",
      createdAt,
      sender: null,
    };
    createMessage.mockResolvedValueOnce(created);
    updateConversation.mockResolvedValueOnce({});
    publishChatMessage.mockRejectedValueOnce(new Error("realtime down"));

    const response = await route.POST(postRequest({ body: "world" }), params());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      message: { ...created, createdAt: createdAtIso },
    });
  });
});
