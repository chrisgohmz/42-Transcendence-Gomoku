import { beforeEach, describe, expect, mock, test } from "bun:test";

const findParticipations = mock();
const countMessages = mock();
const findFriendships = mock();

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

const { getUnreadDirectMessageCountForUser } = await import("./unread");

const lastReadAt = new Date("2026-05-23T09:00:00.000Z");

beforeEach(() => {
  findParticipations.mockReset();
  countMessages.mockReset();
  findFriendships.mockReset();

  findParticipations.mockResolvedValue([]);
  countMessages.mockResolvedValue(0);
  findFriendships.mockResolvedValue([]);
});

describe("getUnreadDirectMessageCountForUser", () => {
  test("returns zero without direct conversation participations", async () => {
    const count = await getUnreadDirectMessageCountForUser("user-alice");

    expect(count).toBe(0);

    expect(findFriendships).not.toHaveBeenCalled();
    expect(countMessages).not.toHaveBeenCalled();
  });

  test("counts unread messages only for accepted direct friends", async () => {
    findParticipations.mockResolvedValueOnce([
      participation("conv-bob", "user-bob", lastReadAt),
      participation("conv-carol", "user-carol", null),
    ]);
    findFriendships.mockResolvedValueOnce([{ userLowId: "user-alice", userHighId: "user-bob" }]);
    countMessages.mockResolvedValueOnce(4);

    const count = await getUnreadDirectMessageCountForUser("user-alice");

    expect(count).toBe(4);

    expect(findFriendships).toHaveBeenCalledWith({
      where: {
        OR: [
          { userLowId: "user-alice", userHighId: "user-bob" },
          { userLowId: "user-alice", userHighId: "user-carol" },
        ],
        status: "ACCEPTED",
      },
      select: { userLowId: true, userHighId: true },
    });
    expect(countMessages).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            conversationId: "conv-bob",
            createdAt: { gt: lastReadAt },
            deletedAt: null,
            senderUserId: { not: "user-alice" },
          },
        ],
      },
    });
  });
});

function participation(conversationId: string, otherUserId: string, readAt: Date | null) {
  return {
    conversationId,
    lastReadAt: readAt,
    conversation: {
      participants: [{ userId: otherUserId }],
    },
  };
}
