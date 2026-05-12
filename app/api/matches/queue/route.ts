import { getCurrentSession } from "@/lib/auth";
import {
  cancelMatchmakingQueue,
  getMatchmakingQueueStatus,
  joinMatchmakingQueue,
} from "@/lib/matches/matchmaking";

export const dynamic = "force-dynamic";

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
    return Response.json(
      {
        detail: getErrorMessage(error),
        error: "failed_to_load_queue_status",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  const context = await getCurrentSession();

  if (!context) {
    return unauthorizedResponse();
  }

  try {
    return Response.json(await joinMatchmakingQueue(context.user));
  } catch (error) {
    return Response.json(
      {
        detail: getErrorMessage(error),
        error: "failed_to_join_queue",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const context = await getCurrentSession();

  if (!context) {
    return unauthorizedResponse();
  }

  try {
    return Response.json(await cancelMatchmakingQueue(context.user));
  } catch (error) {
    return Response.json(
      {
        detail: getErrorMessage(error),
        error: "failed_to_cancel_queue",
      },
      { status: 500 },
    );
  }
}
