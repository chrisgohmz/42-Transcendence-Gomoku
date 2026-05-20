// This file handles two routes on the same conversation:
//
//   GET  /api/conversations/[id]/messages  → load message history
//   POST /api/conversations/[id]/messages  → send a new message
//
// [id] is a dynamic segment — Next.js passes it in `params`.

import { getErrorMessage } from "@/lib/api-errors";
import { getCurrentSession } from "@/lib/auth";
import { publishChatMessage } from "@/lib/chat/realtime-publisher";
import { prisma } from "@/lib/prisma";

// not useable with cacheComponents
//export const dynamic = "force-dynamic";

// ─── Helper ──────────────────────────────────────────────────────────────────

// Before doing anything with a conversation, verify the logged-in user
// is actually a participant. This prevents users from reading other people's chats.
async function getParticipation(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: {
      // This is the unique constraint defined in the schema: [conversationId, userId]
      conversationId_userId: { conversationId, userId },
    },
  });
}

// ─── GET: load message history ────────────────────────────────────────────────

export async function GET(
  _request: Request,
  // Next.js passes route params as a Promise in the App Router
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Security check: user must be a participant of this conversation
  const participation = await getParticipation(conversationId, session.user.id);
  if (!participation) {
    return Response.json({ error: "conversation_not_found" }, { status: 404 });
  }

  try {
    // Fetch messages oldest-first (so the UI can render them top to bottom)
    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId,
        deletedAt: null, // skip soft-deleted messages
      },
      include: {
        // Include the sender's info so the UI can show their name/avatar
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark conversation as read: update the lastReadAt timestamp for this user
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId: session.user.id },
      },
      data: { lastReadAt: new Date() },
    });

    return Response.json({ messages });
  } catch (error) {
    return Response.json(
      { error: "failed_to_load_messages", detail: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// ─── POST: send a message ─────────────────────────────────────────────────────

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Security check: user must be a participant
  const participation = await getParticipation(conversationId, session.user.id);
  if (!participation) {
    return Response.json({ error: "conversation_not_found" }, { status: 404 });
  }

  // Parse and validate the request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawBody = body as Record<string, unknown>;
  const text = typeof rawBody["body"] === "string" ? rawBody["body"].trim() : "";

  if (text.length === 0) {
    return Response.json({ error: "message body cannot be empty" }, { status: 400 });
  }
  if (text.length > 2000) {
    return Response.json({ error: "message too long (max 2000 chars)" }, { status: 400 });
  }

  try {
    // Save the message to the database
    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderUserId: session.user.id,
        kind: "USER",
        body: text,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update the conversation's lastMessageAt so it appears at the top of lists
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });

    // Notify the Socket.IO server so it can push the message to everyone
    // who currently has this conversation open.
    // We wrap this in try/catch so a realtime failure doesn't break message sending —
    // the message is already saved in the DB, which is the source of truth.
    try {
      await publishChatMessage({ conversationId, message });
    } catch (realtimeError) {
      console.error("[chat] Failed to publish realtime message", realtimeError);
    }

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: "failed_to_send_message", detail: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
