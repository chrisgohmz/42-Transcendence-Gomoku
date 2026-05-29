import { Prisma } from "@/../generated/prisma/client";
import { MatchResult, MatchStatus } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { cancelWaitingMatchRequestSchema } from "@/lib/matches/move-request-validation";
import { isActiveParticipantForUser } from "@/lib/matches/participant-access";
import { publishGameUpdate } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

const endReasonHostCancelled = "host_cancelled";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestGuardResponse = enforceMutationRequest(request, { requireJson: true });

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const context = await getCurrentSession();

  if (!context) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id: matchId } = await params;
    const body = await request.json().catch(() => null);
    const requestValidation = cancelWaitingMatchRequestSchema.safeParse(body);

    if (!requestValidation.success) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const participantId = requestValidation.data.participantId;
    const baseVersion = requestValidation.data.baseVersion ?? null;
    const rateLimitExceededResponse = await enforceRateLimit(
      request.headers,
      rateLimitRule("matchCancel", userRateLimitSubject(context.user.id)),
    );

    if (rateLimitExceededResponse) {
      return rateLimitExceededResponse;
    }

    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          participants: true,
          moves: {
            orderBy: { moveNumber: "asc" },
          },
        },
      });

      if (!match) {
        return {
          kind: "error" as const,
          payload: { error: "match_not_found", status: 404 },
        };
      }

      if (!isActiveParticipantForUser(match.participants, participantId, context.user.id)) {
        return {
          kind: "error" as const,
          payload: { error: "participant_not_found", status: 403 },
        };
      }

      if (match.createdByUserId && match.createdByUserId !== context.user.id) {
        return {
          kind: "error" as const,
          payload: { error: "only_host_can_cancel", status: 403 },
        };
      }

      if (match.status !== MatchStatus.WAITING) {
        return {
          kind: "error" as const,
          payload: { error: "match_not_waiting", status: 409 },
        };
      }

      if (baseVersion !== null && baseVersion !== match.stateVersion) {
        return {
          kind: "error" as const,
          payload: { error: "stale_state", status: 409 },
        };
      }

      const finishedAt = new Date();
      const nextStateVersion = match.stateVersion + 1;
      const matchUpdate = {
        endReason: endReasonHostCancelled,
        finishedAt,
        nextTurnSeat: null,
        stateVersion: nextStateVersion,
        status: MatchStatus.CANCELLED,
        winningSeat: null,
      };
      const guardedTransition = await tx.match.updateMany({
        where: {
          id: matchId,
          stateVersion: match.stateVersion,
          status: MatchStatus.WAITING,
        },
        data: matchUpdate,
      });

      if (guardedTransition.count !== 1) {
        return {
          kind: "error" as const,
          payload: { error: "stale_state", status: 409 },
        };
      }

      await tx.matchParticipant.updateMany({
        where: {
          leftAt: null,
          matchId,
          result: null,
        },
        data: {
          leftAt: finishedAt,
          result: MatchResult.CANCELLED,
        },
      });

      return {
        kind: "ok" as const,
        payload: {
          match: { ...match, ...matchUpdate },
          moves: match.moves,
          participants: match.participants,
        },
      };
    });

    if (result.kind === "error") {
      return Response.json({ error: result.payload.error }, { status: result.payload.status });
    }

    const gameUpdate = buildGameUpdatePayload({
      match: result.payload.match,
      participants: result.payload.participants,
      moves: result.payload.moves,
    });

    try {
      const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);
      await publishGameUpdate(gameUpdate, timeoutMs);
    } catch (publishError) {
      console.error(`[matches/${matchId}] realtime publish failed:`, getErrorMessage(publishError));
    }

    return Response.json({
      ok: true,
      accepted: true,
      stateVersion: result.payload.match.stateVersion,
      endReason: result.payload.match.endReason,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[api/matches/cancel] prisma failure:", getErrorMessage(error));
      return Response.json(
        {
          error: "failed_to_cancel_match",
        },
        { status: 409 },
      );
    }

    console.error("[api/matches/cancel] failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_cancel_match",
      },
      { status: 500 },
    );
  }
}
