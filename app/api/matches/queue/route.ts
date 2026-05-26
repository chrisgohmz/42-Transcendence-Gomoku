import { getCurrentSession } from "@/lib/auth";
import {
  cancelMatchmakingQueue,
  getMatchmakingQueueStatus,
  joinMatchmakingQueue,
} from "@/lib/matches/matchmaking";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
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

export async function POST(
  request: Request = new Request("http://localhost/api/matches/queue", { method: "POST" }),
) {
  const requestGuardResponse = enforceMutationRequest(request);

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const context = await getCurrentSession();

  if (!context) {
    return unauthorizedResponse();
  }

  try {
    const rateLimit = consumeRateLimit(request.headers, {
      key: "matches:queue:join",
      max: 30,
      subject: `user:${context.user.id}`,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
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

export async function DELETE(
  request: Request = new Request("http://localhost/api/matches/queue", { method: "DELETE" }),
) {
  const requestGuardResponse = enforceMutationRequest(request);

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const context = await getCurrentSession();

  if (!context) {
    return unauthorizedResponse();
  }

  try {
    const rateLimit = consumeRateLimit(request.headers, {
      key: "matches:queue:cancel",
      max: 30,
      subject: `user:${context.user.id}`,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
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
