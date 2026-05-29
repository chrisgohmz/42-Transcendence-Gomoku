// This route explicitly acknowledges that the active user has read a direct
// conversation. It is used by the realtime message path, where loading history
// is not involved.

import { getErrorMessage } from "@/lib/api-errors";
import { getCurrentSession } from "@/lib/auth";
import { canAccessDirectConversation } from "@/lib/chat/access";
import { markDirectConversationRead } from "@/lib/chat/read-state";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

function deniedResponse(reason: "not_found" | "not_friends" | "not_direct") {
  if (reason === "not_found") {
    return Response.json({ error: "conversation_not_found" }, { status: 404 });
  }
  return Response.json({ error: "not_friends" }, { status: 403 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestGuardResponse = enforceMutationRequest(request);

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
    rateLimitRule("conversationRead", userRateLimitSubject(session.user.id)),
  );

  if (rateLimitExceededResponse) {
    return rateLimitExceededResponse;
  }

  try {
    const lastReadAt = await markDirectConversationRead(conversationId, session.user.id);
    return Response.json({ lastReadAt });
  } catch (error) {
    console.error("[api/conversations/read] mark failed:", getErrorMessage(error));
    return Response.json({ error: "failed_to_mark_conversation_read" }, { status: 500 });
  }
}
