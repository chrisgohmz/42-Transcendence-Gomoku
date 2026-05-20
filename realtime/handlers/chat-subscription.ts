// This file registers Socket.IO event handlers for chat.
//
// When a user opens a conversation, their browser emits "chat:subscribe".
// This handler joins them to a Socket.IO room named "conv:CONVERSATION_ID".
// Any message broadcast to that room will arrive in their browser instantly.
//
// Compare to match-subscription.ts — same pattern, simpler auth check.

import type { Socket } from "socket.io";

import { prisma } from "@/lib/prisma";

// The name of the Socket.IO room for a given conversation
export function convRoomId(conversationId: string): string {
  return `conv:${conversationId}`;
}

export function registerChatSubscription(socket: Socket) {
  // Event: browser → server, "I want to receive messages for this conversation"
  socket.on("chat:subscribe", async (payload: unknown) => {
    // Validate the payload — it must be an object with a conversationId string
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as Record<string, unknown>)["conversationId"] !== "string"
    ) {
      socket.emit("chat:error", { error: "invalid_payload" });
      return;
    }

    const conversationId = (payload as Record<string, unknown>)["conversationId"] as string;

    // Get the authenticated user from the socket (set during the handshake by socket-auth.ts)
    const userId = socket.data.user?.id;
    if (!userId) {
      socket.emit("chat:error", { error: "unauthorized" });
      return;
    }

    try {
      // Security check: confirm this user is actually a participant of this conversation
      const participation = await prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });

      if (!participation) {
        socket.emit("chat:error", { error: "conversation_not_found" });
        return;
      }

      // Join the room — from now on, broadcasts to this room reach this socket
      const room = convRoomId(conversationId);
      await socket.join(room);

      console.log(`[chat] ${socket.id} joined room ${room}`);

      // Confirm subscription to the browser
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
