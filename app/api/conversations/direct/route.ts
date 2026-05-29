// This file handles: POST /api/conversations/direct
//
// Called when the user clicks on a friend to start chatting.
// It finds an existing conversation between the two users, or creates one.
//
// Request body: { friendId: string }
// Response: { conversationId: string }
//
// The "directKey" field in the Conversation table was designed exactly for this.
// It stores a sorted pair of user IDs: "userA_id:userB_id"
// Sorting guarantees the key is always the same regardless of who opens the chat first.

import { getErrorMessage } from "@/lib/api-errors";
import { getCurrentSession } from "@/lib/auth";
import { isAcceptedFriend } from "@/lib/chat/access";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const requestGuardResponse = enforceMutationRequest(request, { requireJson: true });

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  // 1. Check login
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Read the request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  // 3. Validate that friendId is a non-empty string
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>)["friendId"] !== "string" ||
    ((body as Record<string, unknown>)["friendId"] as string).trim().length === 0
  ) {
    return Response.json({ error: "friendId is required" }, { status: 400 });
  }

  const friendId = ((body as Record<string, unknown>)["friendId"] as string).trim();

  // 4. Can't chat with yourself
  if (friendId === session.user.id) {
    return Response.json({ error: "cannot_chat_with_self" }, { status: 400 });
  }

  // 5. Make sure the friend actually exists in the database
  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true },
  });
  if (!friend) {
    return Response.json({ error: "user_not_found" }, { status: 404 });
  }

  // 5b. Only accepted friends can DM each other.
  if (!(await isAcceptedFriend(session.user.id, friendId))) {
    return Response.json({ error: "not_friends" }, { status: 403 });
  }

  try {
    const rateLimitExceededResponse = await enforceRateLimit(
      request.headers,
      rateLimitRule("conversationDirect", userRateLimitSubject(session.user.id)),
    );

    if (rateLimitExceededResponse) {
      return rateLimitExceededResponse;
    }

    // 6. Build the directKey — sort the two IDs so the key is always identical
    //    no matter which user initiates the conversation
    //    e.g. if userA = "abc" and userB = "xyz", key = "abc:xyz" always
    const directKey = [session.user.id, friendId].sort().join(":");

    // 7. upsert = "find it if it exists, create it if it doesn't"
    //    This is atomic — safe to call multiple times, won't create duplicates
    const conversation = await prisma.conversation.upsert({
      where: { directKey },
      update: {}, // nothing to update if it already exists
      create: {
        kind: "DIRECT",
        directKey,
        // Add both users as participants at creation time
        participants: {
          create: [{ userId: session.user.id }, { userId: friendId }],
        },
      },
    });

    return Response.json({ conversationId: conversation.id });
  } catch (error) {
    console.error("[api/conversations/direct] create failed:", getErrorMessage(error));
    return Response.json({ error: "failed_to_create_conversation" }, { status: 500 });
  }
}
