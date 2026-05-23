import { beforeEach, describe, expect, mock, test } from "bun:test";

await mock.module("@/lib/prisma", () => ({ prisma: {} }));

const { canAccessDirectConversation, isAcceptedFriend, sortFriendshipKey } =
  await import("./access");

const findParticipant = mock();
const findConversation = mock();
const findFriendship = mock();

const db = {
  conversation: { findUnique: findConversation },
  conversationParticipant: { findUnique: findParticipant },
  friendship: { findUnique: findFriendship },
};

beforeEach(() => {
  findParticipant.mockReset();
  findConversation.mockReset();
  findFriendship.mockReset();
});

describe("sortFriendshipKey", () => {
  test("returns low/high regardless of argument order", () => {
    expect(sortFriendshipKey("z", "a")).toEqual({ userLowId: "a", userHighId: "z" });
    expect(sortFriendshipKey("a", "z")).toEqual({ userLowId: "a", userHighId: "z" });
  });
});

describe("isAcceptedFriend", () => {
  test("returns false when comparing a user to themselves", async () => {
    expect(await isAcceptedFriend("user-a", "user-a", db)).toBe(false);
    expect(findFriendship).not.toHaveBeenCalled();
  });

  test("returns false when friendship row is missing", async () => {
    findFriendship.mockResolvedValueOnce(null);
    expect(await isAcceptedFriend("user-a", "user-b", db)).toBe(false);
  });

  test("returns false when friendship is not ACCEPTED", async () => {
    findFriendship.mockResolvedValueOnce({ status: "PENDING" });
    expect(await isAcceptedFriend("user-a", "user-b", db)).toBe(false);
  });

  test("returns true when friendship is ACCEPTED", async () => {
    findFriendship.mockResolvedValueOnce({ status: "ACCEPTED" });
    expect(await isAcceptedFriend("user-a", "user-b", db)).toBe(true);
    expect(findFriendship).toHaveBeenCalledWith({
      where: {
        userLowId_userHighId: { userLowId: "user-a", userHighId: "user-b" },
      },
      select: { status: true },
    });
  });
});

describe("canAccessDirectConversation", () => {
  test("not_found when user is not a participant", async () => {
    findParticipant.mockResolvedValueOnce(null);
    const result = await canAccessDirectConversation("user-a", "conv-1", db);
    expect(result).toEqual({ allowed: false, reason: "not_found" });
    expect(findConversation).not.toHaveBeenCalled();
  });

  test("not_found when conversation row is missing", async () => {
    findParticipant.mockResolvedValueOnce({ id: "p1" });
    findConversation.mockResolvedValueOnce(null);
    const result = await canAccessDirectConversation("user-a", "conv-1", db);
    expect(result).toEqual({ allowed: false, reason: "not_found" });
  });

  test("not_direct for non-direct conversations", async () => {
    findParticipant.mockResolvedValueOnce({ id: "p1" });
    findConversation.mockResolvedValueOnce({
      kind: "MATCH",
      participants: [{ userId: "user-b" }],
    });
    const result = await canAccessDirectConversation("user-a", "conv-1", db);
    expect(result).toEqual({ allowed: false, reason: "not_direct" });
  });

  test("not_friends when other participant is no longer an accepted friend", async () => {
    findParticipant.mockResolvedValueOnce({ id: "p1" });
    findConversation.mockResolvedValueOnce({
      kind: "DIRECT",
      participants: [{ userId: "user-b" }],
    });
    findFriendship.mockResolvedValueOnce(null);
    const result = await canAccessDirectConversation("user-a", "conv-1", db);
    expect(result).toEqual({ allowed: false, reason: "not_friends" });
  });

  test("allowed when user is participant and accepted friend", async () => {
    findParticipant.mockResolvedValueOnce({ id: "p1" });
    findConversation.mockResolvedValueOnce({
      kind: "DIRECT",
      participants: [{ userId: "user-b" }],
    });
    findFriendship.mockResolvedValueOnce({ status: "ACCEPTED" });
    const result = await canAccessDirectConversation("user-a", "conv-1", db);
    expect(result).toEqual({ allowed: true, otherUserId: "user-b" });
  });
});
