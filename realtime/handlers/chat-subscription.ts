// This file registers Socket.IO event handlers for chat.
//
// When a user opens a conversation, their browser emits "chat:subscribe".
// This handler joins them to a Socket.IO room named "conv:CONVERSATION_ID".
// Any message broadcast to that room will arrive in their browser instantly.
//
// Compare to match-subscription.ts — same pattern, plus an active-friendship
// check via the shared `canAccessDirectConversation` helper so users can't
// keep reading/sending after unfriending.

import type { Socket } from "socket.io";

import { canAccessDirectConversation, type DirectMessageAccessStore } from "@/lib/chat/access";
import { prisma } from "@/lib/prisma";

import { convRoomId } from "../lib/rooms";

export { convRoomId };

export function registerChatSubscription(socket: Socket, db: DirectMessageAccessStore = prisma) {
  // Event: browser → server, "I want to receive messages for this conversation"
  socket.on("chat:subscribe", async (payload: unknown) => {
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as Record<string, unknown>)["conversationId"] !== "string"
    ) {
      socket.emit("chat:error", { error: "invalid_payload" });
      return;
    }

    const conversationId = (payload as Record<string, unknown>)["conversationId"] as string;

    const userId = socket.data.user?.id;
    if (typeof userId !== "string" || userId.length === 0) {
      socket.emit("chat:error", { error: "unauthorized" });
      return;
    }

    try {
      const access = await canAccessDirectConversation(userId, conversationId, db);
      if (!access.allowed) {
        const errorCode = access.reason === "not_found" ? "conversation_not_found" : "not_friends";
        socket.emit("chat:error", { error: errorCode });
        return;
      }

      const room = convRoomId(conversationId);
      await socket.join(room);

      console.log(`[chat] ${socket.id} joined room ${room}`);
      socket.emit("chat:subscribed", { conversationId });
    } catch (error) {
      console.error("[chat] Failed to subscribe", error);
      socket.emit("chat:error", { error: "subscription_failed" });
    }
  });

  // Event: user wants to leave a conversation (e.g. navigates away)
  socket.on("chat:unsubscribe", async (payload: unknown) => {
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as Record<string, unknown>)["conversationId"] !== "string"
    ) {
      return;
    }

    const conversationId = (payload as Record<string, unknown>)["conversationId"] as string;
    const room = convRoomId(conversationId);
    await socket.leave(room);
    console.log(`[chat] ${socket.id} left room ${room}`);
  });
}
