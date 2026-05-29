import { getCurrentSession } from "@/lib/auth";
import {
  cancelMatchmakingQueue,
  getMatchmakingQueueStatus,
  joinMatchmakingQueue,
} from "@/lib/matches/matchmaking";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function unauthorizedResponse() {
  return Response.json(
    {
      error: "unauthorized",
      message: "You need to sign in before using matchmaking.",
    },
    { status: 401 },
  );
}

export async function GET() {
  const context = await getCurrentSession();

  if (!context) {
    return unauthorizedResponse();
  }

  try {
    return Response.json(await getMatchmakingQueueStatus(context.user));
  } catch (error) {
    console.error("[api/matches/queue] status failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_load_queue_status",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const requestGuardResponse = enforceMutationRequest(request);

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const context = await getCurrentSession();

  if (!context) {
    return unauthorizedResponse();
  }

  try {
    const rateLimitExceededResponse = await enforceRateLimit(
      request.headers,
      rateLimitRule("matchQueueJoin", userRateLimitSubject(context.user.id)),
    );

    if (rateLimitExceededResponse) {
      return rateLimitExceededResponse;
    }

    return Response.json(await joinMatchmakingQueue(context.user));
  } catch (error) {
    console.error("[api/matches/queue] join failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_join_queue",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const requestGuardResponse = enforceMutationRequest(request);

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const context = await getCurrentSession();

  if (!context) {
    return unauthorizedResponse();
  }

  try {
    const rateLimitExceededResponse = await enforceRateLimit(
      request.headers,
      rateLimitRule("matchQueueCancel", userRateLimitSubject(context.user.id)),
    );

    if (rateLimitExceededResponse) {
      return rateLimitExceededResponse;
    }

    return Response.json(await cancelMatchmakingQueue(context.user));
  } catch (error) {
    console.error("[api/matches/queue] cancel failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_cancel_queue",
      },
      { status: 500 },
    );
  }
}
