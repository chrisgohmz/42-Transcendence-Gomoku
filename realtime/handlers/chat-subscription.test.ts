import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Socket } from "socket.io";

await mock.module("@/lib/prisma", () => ({ prisma: {} }));

const { registerChatSubscription } = await import("./chat-subscription");

const findParticipant = mock();
const findConversation = mock();
const findFriendship = mock();
const join = mock();
const leave = mock();
const emit = mock();
const on = mock();

const db = {
  conversation: { findUnique: findConversation },
  conversationParticipant: { findUnique: findParticipant },
  friendship: { findUnique: findFriendship },
};

type Handlers = Map<string, (payload: unknown) => Promise<void>>;

function buildSocket(userId: string | null = "user-alice") {
  const handlers: Handlers = new Map();
  on.mockImplementation((event: string, handler: (payload: unknown) => Promise<void>) => {
    handlers.set(event, handler);
  });

  return {
    handlers,
    socket: {
      data: { user: userId ? { id: userId } : null },
      emit,
      id: "socket-1",
      join,
      leave,
      on,
    } as unknown as Socket,
  };
}

function directConversation() {
  return {
    kind: "DIRECT",
    participants: [{ userId: "user-bob" }],
  };
}

beforeEach(() => {
  findParticipant.mockReset();
  findConversation.mockReset();
  findFriendship.mockReset();
  join.mockReset();
  leave.mockReset();
  emit.mockReset();
  on.mockReset();
  join.mockResolvedValue(undefined);
  leave.mockResolvedValue(undefined);

  findParticipant.mockResolvedValue({ id: "participation-1" });
  findConversation.mockResolvedValue(directConversation());
  findFriendship.mockResolvedValue({ status: "ACCEPTED" });
});

describe("registerChatSubscription", () => {
  test("rejects malformed payloads", async () => {
    const { handlers, socket } = buildSocket();
    registerChatSubscription(socket, db);

    await handlers.get("chat:subscribe")?.({});

    expect(emit).toHaveBeenCalledWith("chat:error", { error: "invalid_payload" });
    expect(findParticipant).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
  });

  test("rejects when the socket has no authenticated user", async () => {
    const { handlers, socket } = buildSocket(null);
    registerChatSubscription(socket, db);

    await handlers.get("chat:subscribe")?.({ conversationId: "conv-1" });

    expect(emit).toHaveBeenCalledWith("chat:error", { error: "unauthorized" });
    expect(findParticipant).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
  });

  test("rejects subscriptions when the user is not a participant", async () => {
    const { handlers, socket } = buildSocket();
    findParticipant.mockResolvedValueOnce(null);
    registerChatSubscription(socket, db);

    await handlers.get("chat:subscribe")?.({ conversationId: "conv-1" });

    expect(emit).toHaveBeenCalledWith("chat:error", { error: "conversation_not_found" });
    expect(join).not.toHaveBeenCalled();
  });

  test("rejects subscriptions after the friendship has been removed", async () => {
    const { handlers, socket } = buildSocket();
    findFriendship.mockResolvedValueOnce(null);
    registerChatSubscription(socket, db);

    await handlers.get("chat:subscribe")?.({ conversationId: "conv-1" });

    expect(emit).toHaveBeenCalledWith("chat:error", { error: "not_friends" });
    expect(join).not.toHaveBeenCalled();
  });

  test("rejects subscriptions to non-direct conversations through this socket path", async () => {
    const { handlers, socket } = buildSocket();
    findConversation.mockResolvedValueOnce({
      kind: "MATCH",
      participants: [{ userId: "user-bob" }],
    });
    registerChatSubscription(socket, db);

    await handlers.get("chat:subscribe")?.({ conversationId: "conv-1" });

    expect(emit).toHaveBeenCalledWith("chat:error", { error: "not_friends" });
    expect(join).not.toHaveBeenCalled();
  });

  test("joins the room when the user is an accepted-friend participant", async () => {
    const { handlers, socket } = buildSocket();
    registerChatSubscription(socket, db);

    await handlers.get("chat:subscribe")?.({ conversationId: "conv-1" });

    expect(join).toHaveBeenCalledWith("conv:conv-1");
    expect(emit).toHaveBeenCalledWith("chat:subscribed", { conversationId: "conv-1" });
  });

  test("leaves the room on chat:unsubscribe", async () => {
    const { handlers, socket } = buildSocket();
    registerChatSubscription(socket, db);

    await handlers.get("chat:unsubscribe")?.({ conversationId: "conv-1" });

    expect(leave).toHaveBeenCalledWith("conv:conv-1");
  });

  test("ignores malformed unsubscribe payloads", async () => {
    const { handlers, socket } = buildSocket();
    registerChatSubscription(socket, db);

    await handlers.get("chat:unsubscribe")?.({});

    expect(leave).not.toHaveBeenCalled();
  });
});
