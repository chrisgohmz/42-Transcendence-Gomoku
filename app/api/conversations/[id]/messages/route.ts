// This file handles two routes on the same conversation:
//
//   GET  /api/conversations/[id]/messages  → load message history
//   POST /api/conversations/[id]/messages  → send a new message
//
// [id] is a dynamic segment — Next.js passes it in `params`.

import { getErrorMessage } from "@/lib/api-errors";
import { getCurrentSession } from "@/lib/auth";
import { canAccessDirectConversation } from "@/lib/chat/access";
import { markDirectConversationRead } from "@/lib/chat/read-state";
import { publishChatMessage } from "@/lib/chat/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

// not useable with cacheComponents
//export const dynamic = "force-dynamic";

// Map the shared access result to an HTTP response.
function deniedResponse(reason: "not_found" | "not_friends" | "not_direct") {
  if (reason === "not_found") {
    return Response.json({ error: "conversation_not_found" }, { status: 404 });
  }
  return Response.json({ error: "not_friends" }, { status: 403 });
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

  const access = await canAccessDirectConversation(session.user.id, conversationId);
  if (!access.allowed) {
    return deniedResponse(access.reason);
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

    // Mark conversation as read: update the lastReadAt timestamp for this user.
    await markDirectConversationRead(conversationId, session.user.id);

    return Response.json({ messages });
  } catch (error) {
    console.error("[api/conversations/messages] load failed:", getErrorMessage(error));
    return Response.json({ error: "failed_to_load_messages" }, { status: 500 });
  }
}

// ─── POST: send a message ─────────────────────────────────────────────────────

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestGuardResponse = enforceMutationRequest(request, { requireJson: true });

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const access = await canAccessDirectConversation(session.user.id, conversationId);
  if (!access.allowed) {
    return deniedResponse(access.reason);
  }

  const rateLimitExceededResponse = await enforceRateLimit(
    request.headers,
    rateLimitRule("conversationMessage", userRateLimitSubject(session.user.id)),
  );

  if (rateLimitExceededResponse) {
    return rateLimitExceededResponse;
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

  let message;
  try {
    // Persist the message and bump lastMessageAt atomically so the sidebar
    // never sees a committed message without an updated preview ordering.
    message = await prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
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
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      return created;
    });
  } catch (error) {
    console.error("[api/conversations/messages] send failed:", getErrorMessage(error));
    return Response.json({ error: "failed_to_send_message" }, { status: 500 });
  }

  // Realtime publish runs only after the DB transaction has committed.
  // A failure here doesn't roll back the message — the sender already
  // gets it in the response body and other clients will fetch on reload.
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: access.otherUserId },
      select: { username: true },
    });

    await publishChatMessage({
      conversationId,
      message,
      recipientUsername: recipient?.username,
    });
  } catch (realtimeError) {
    console.error("[chat] Failed to publish realtime message", realtimeError);
  }

  return Response.json({ message }, { status: 201 });
}
