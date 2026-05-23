import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

await mock.module("server-only", () => ({}));

const getCurrentSession = mock();
const findParticipations = mock();
const findFriendships = mock();
const countMessages = mock();

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/prisma", () => ({
  prisma: {
    conversationParticipant: {
      findMany: findParticipations,
    },
    directMessage: {
      count: countMessages,
    },
    friendship: {
      findMany: findFriendships,
    },
  },
}));

const route = await import("./route");

const lastMessageAt = new Date("2026-05-12T11:00:00.000Z");

function bobConversation() {
  return {
    conversation: {
      id: "conv-bob",
      lastMessageAt,
      participants: [
        {
          userId: "user-alice",
          user: {
            id: "user-alice",
            username: "alice",
            displayName: "Alice",
            avatarUrl: null,
          },
        },
        {
          userId: "user-bob",
          user: {
            id: "user-bob",
            username: "bob",
            displayName: "Bob",
            avatarUrl: null,
          },
        },
      ],
      messages: [{ body: "hi bob" }],
    },
    lastReadAt: null,
  };
}

function carolConversation() {
  return {
    conversation: {
      id: "conv-carol",
      lastMessageAt: null,
      participants: [
        {
          userId: "user-alice",
          user: {
            id: "user-alice",
            username: "alice",
            displayName: "Alice",
            avatarUrl: null,
          },
        },
        {
          userId: "user-carol",
          user: {
            id: "user-carol",
            username: "carol",
            displayName: "Carol",
            avatarUrl: null,
          },
        },
      ],
      messages: [],
    },
    lastReadAt: null,
  };
}

beforeEach(() => {
  getCurrentSession.mockReset();
  findParticipations.mockReset();
  findFriendships.mockReset();
  countMessages.mockReset();

  getCurrentSession.mockResolvedValue({
    user: { id: "user-alice", username: "alice", displayName: "Alice" },
  });
  findParticipations.mockResolvedValue([]);
  findFriendships.mockResolvedValue([]);
  countMessages.mockResolvedValue(0);
});

describe("GET /api/conversations", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(findParticipations).not.toHaveBeenCalled();
  });

  test("queries only DIRECT conversations for the current user", async () => {
    await route.GET();

    expect(findParticipations).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-alice",
          conversation: { kind: "DIRECT" },
        },
      }),
    );
  });

  test("filters out conversations where the other user is no longer an accepted friend", async () => {
    findParticipations.mockResolvedValueOnce([bobConversation(), carolConversation()]);
    findFriendships.mockResolvedValueOnce([{ userLowId: "user-alice", userHighId: "user-bob" }]);

    const response = await route.GET();
    const data = (await response.json()) as { conversations: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(data.conversations.map((c) => c.id)).toEqual(["conv-bob"]);
    expect(findFriendships).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACCEPTED" }),
      }),
    );
  });

  test("returns empty list when user has no participations", async () => {
    findParticipations.mockResolvedValueOnce([]);

    const response = await route.GET();
    const data = (await response.json()) as { conversations: unknown[] };

    expect(data.conversations).toEqual([]);
    expect(findFriendships).not.toHaveBeenCalled();
  });

  test("includes unread count and last message preview for accepted friends", async () => {
    findParticipations.mockResolvedValueOnce([bobConversation()]);
    findFriendships.mockResolvedValueOnce([{ userLowId: "user-alice", userHighId: "user-bob" }]);
    countMessages.mockResolvedValueOnce(3);

    const response = await route.GET();
    const data = (await response.json()) as {
      conversations: Array<{
        id: string;
        unreadCount: number;
        lastMessage: string | null;
        otherUser: { id: string };
      }>;
    };

    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0]).toMatchObject({
      id: "conv-bob",
      unreadCount: 3,
      lastMessage: "hi bob",
      otherUser: expect.objectContaining({ id: "user-bob" }),
    });
    expect(countMessages).toHaveBeenCalledWith({
      where: expect.objectContaining({
        conversationId: "conv-bob",
        deletedAt: null,
        senderUserId: { not: "user-alice" },
      }),
    });
  });
});
