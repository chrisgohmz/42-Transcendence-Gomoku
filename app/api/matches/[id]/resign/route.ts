import { Prisma } from "@/../generated/prisma/client";
import { MatchStatus, Role } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { resignMatchRequestSchema } from "@/lib/matches/move-request-validation";
import { validateResignation } from "@/lib/matches/move-rules";
import { isActiveParticipantForUser } from "@/lib/matches/participant-access";
import { publishGameUpdate } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { syncUserGameStatsForUser } from "@/lib/stats/result-sync";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getHumanPlayerUserIds(
  participants: Array<{ role: Role; userId: string | null }>,
): string[] {
  const userIds = new Set<string>();
  for (const participant of participants) {
    if (participant.role === Role.PLAYER && participant.userId) {
      userIds.add(participant.userId);
    }
  }
  return [...userIds];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id: matchId } = await params;
    const body = await request.json().catch(() => null);
    const requestValidation = resignMatchRequestSchema.safeParse(body);

    if (!requestValidation.success) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const participantId = requestValidation.data.participantId;
    const baseVersion = requestValidation.data.baseVersion ?? null;

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

      const resignationValidation = validateResignation({
        match,
        participantId,
        baseVersion,
      });

      if (!resignationValidation.ok) {
        return {
          kind: "error" as const,
          payload: {
            error: resignationValidation.error,
            status: resignationValidation.status,
          },
        };
      }

      const finishedAt = new Date();
      const matchUpdate = {
        stateVersion: resignationValidation.nextStateVersion,
        status: resignationValidation.transition.status,
        nextTurnSeat: resignationValidation.transition.nextTurnSeat,
        winningSeat: resignationValidation.transition.winningSeat,
        endReason: resignationValidation.transition.endReason,
        finishedAt,
      };
      const guardedTransition = await tx.match.updateMany({
        where: {
          id: matchId,
          status: match.status,
          stateVersion: match.stateVersion,
        },
        data: matchUpdate,
      });

      if (guardedTransition.count !== 1) {
        return {
          kind: "error" as const,
          payload: { error: "stale_state", status: 409 },
        };
      }

      await Promise.all(
        resignationValidation.transition.participantResults.map((participantResult) =>
          tx.matchParticipant.update({
            where: { id: participantResult.participantId },
            data: { result: participantResult.result },
          }),
        ),
      );

      return {
        kind: "ok" as const,
        payload: {
          match: { ...match, ...matchUpdate },
          participants: match.participants,
          moves: match.moves,
        },
      };
    });

    if (result.kind === "error") {
      return Response.json({ error: result.payload.error }, { status: result.payload.status });
    }

    if (
      result.payload.match.status === MatchStatus.FINISHED ||
      result.payload.match.status === MatchStatus.CANCELLED
    ) {
      const userIds = getHumanPlayerUserIds(result.payload.participants);

      if (userIds.length > 0) {
        try {
          await Promise.all(userIds.map((userId) => syncUserGameStatsForUser(userId)));
        } catch (syncError) {
          console.error(`[matches/${matchId}] stats sync failed:`, getErrorMessage(syncError));
        }
      }
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
      winningSeat: result.payload.match.winningSeat,
      endReason: result.payload.match.endReason,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return Response.json(
        {
          error: "failed_to_resign_match",
          detail: getErrorMessage(error),
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        error: "failed_to_resign_match",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
