import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

await mock.module("server-only", () => ({}));

const getCurrentSession = mock();
const findUser = mock();
const findFriendship = mock();
const upsertConversation = mock();

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/prisma", () => ({
  prisma: {
    conversation: {
      upsert: upsertConversation,
    },
    friendship: {
      findUnique: findFriendship,
    },
    user: {
      findUnique: findUser,
    },
  },
}));

const route = await import("./route");

function request(body: unknown, options?: { invalidJson?: boolean }) {
  return new Request("http://localhost/api/conversations/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: options?.invalidJson ? "{not-json" : JSON.stringify(body),
  });
}

beforeEach(() => {
  getCurrentSession.mockReset();
  findUser.mockReset();
  findFriendship.mockReset();
  upsertConversation.mockReset();

  getCurrentSession.mockResolvedValue({
    user: {
      displayName: "Alice",
      id: "user-alice",
      username: "alice",
    },
  });
  findUser.mockResolvedValue({ id: "user-bob" });
  findFriendship.mockResolvedValue({ status: "ACCEPTED" });
  upsertConversation.mockResolvedValue({ id: "conv-1" });
});

describe("POST /api/conversations/direct", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.POST(request({ friendId: "user-bob" }));

    expect(response.status).toBe(401);
    expect(findUser).not.toHaveBeenCalled();
    expect(upsertConversation).not.toHaveBeenCalled();
  });

  test("rejects invalid JSON body", async () => {
    const response = await route.POST(request({}, { invalidJson: true }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_json" });
  });

  test("rejects missing or empty friendId", async () => {
    const missingResponse = await route.POST(request({}));
    expect(missingResponse.status).toBe(400);

    const emptyResponse = await route.POST(request({ friendId: "   " }));
    expect(emptyResponse.status).toBe(400);

    expect(findUser).not.toHaveBeenCalled();
  });

  test("rejects chatting with yourself", async () => {
    const response = await route.POST(request({ friendId: "user-alice" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "cannot_chat_with_self" });
    expect(findUser).not.toHaveBeenCalled();
  });

  test("rejects when target user does not exist", async () => {
    findUser.mockResolvedValueOnce(null);

    const response = await route.POST(request({ friendId: "user-bob" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "user_not_found" });
    expect(findFriendship).not.toHaveBeenCalled();
    expect(upsertConversation).not.toHaveBeenCalled();
  });

  test("rejects when users are not accepted friends", async () => {
    findFriendship.mockResolvedValueOnce({ status: "PENDING" });

    const response = await route.POST(request({ friendId: "user-bob" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "not_friends" });
    expect(upsertConversation).not.toHaveBeenCalled();
  });

  test("rejects when no friendship row exists", async () => {
    findFriendship.mockResolvedValueOnce(null);

    const response = await route.POST(request({ friendId: "user-bob" }));

    expect(response.status).toBe(403);
    expect(upsertConversation).not.toHaveBeenCalled();
  });

  test("upserts conversation with sorted directKey for accepted friends", async () => {
    const response = await route.POST(request({ friendId: "user-bob" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ conversationId: "conv-1" });
    expect(findFriendship).toHaveBeenCalledWith({
      where: {
        userLowId_userHighId: {
          userLowId: "user-alice",
          userHighId: "user-bob",
        },
      },
      select: { status: true },
    });

    const upsertArgs = upsertConversation.mock.calls[0]?.[0] as {
      where: { directKey: string };
      create: { kind: string; directKey: string };
    };
    expect(upsertArgs.where.directKey).toBe("user-alice:user-bob");
    expect(upsertArgs.create).toMatchObject({
      kind: "DIRECT",
      directKey: "user-alice:user-bob",
    });
  });

  test("produces the same directKey regardless of who initiates", async () => {
    getCurrentSession.mockResolvedValueOnce({
      user: { id: "user-z", username: "z", displayName: "Z" },
    });
    findUser.mockResolvedValueOnce({ id: "user-a" });
    findFriendship.mockResolvedValueOnce({ status: "ACCEPTED" });

    await route.POST(request({ friendId: "user-a" }));

    const upsertArgs = upsertConversation.mock.calls[0]?.[0] as {
      where: { directKey: string };
    };
    expect(upsertArgs.where.directKey).toBe("user-a:user-z");
  });
});
