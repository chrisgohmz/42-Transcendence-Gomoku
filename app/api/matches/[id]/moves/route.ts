import { Prisma } from "@/../generated/prisma/client";
import { MatchStatus, Role } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { submitMoveRequestSchema } from "@/lib/matches/move-request-validation";
import { evaluateMoveOutcome, validateMoveSubmission } from "@/lib/matches/move-rules";
import { isActiveParticipantForUser } from "@/lib/matches/participant-access";
import { publishGameUpdate } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { syncUserGameStatsForUser } from "@/lib/stats/result-sync";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getUniqueConstraintFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.["target"];

  if (Array.isArray(target)) {
    return target.filter((field): field is string => typeof field === "string");
  }

  return typeof target === "string" ? [target] : [];
}

function mapUniqueConstraintError(error: Prisma.PrismaClientKnownRequestError) {
  const fields = getUniqueConstraintFields(error);

  if (fields.includes("requestId")) {
    return "duplicate_request";
  }

  if (fields.includes("x") || fields.includes("y")) {
    return "occupied";
  }

  return "move_conflict";
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
    const validation = submitMoveRequestSchema.safeParse(body);

    if (!validation.success) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const participantId = validation.data.participantId;
    const position = validation.data.position;
    const requestId = validation.data.requestId ?? null;
    const baseVersion = validation.data.baseVersion ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          participants: true,
          moves: true,
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

      const duplicateRequestMove = requestId
        ? await tx.matchMove.findUnique({
            where: {
              matchId_requestId: {
                matchId,
                requestId,
              },
            },
            select: { id: true },
          })
        : null;

      const validation = validateMoveSubmission({
        match,
        participantId,
        position,
        baseVersion,
        hasDuplicateRequest: duplicateRequestMove !== null,
        isOccupied: false,
      });

      if (!validation.ok) {
        return {
          kind: "error" as const,
          payload: { error: validation.error, status: validation.status },
        };
      }

      const occupiedMove = await tx.matchMove.findUnique({
        where: {
          matchId_x_y: {
            matchId,
            x: position.x,
            y: position.y,
          },
        },
        select: { id: true },
      });

      if (occupiedMove) {
        return {
          kind: "error" as const,
          payload: { error: "occupied", status: 409 },
        };
      }

      const moveNumber = match.moves.length + 1;
      const nextMove = {
        participantId: validation.participant.id,
        moveNumber,
        x: position.x,
        y: position.y,
      };
      const allMoves = [...match.moves, nextMove];
      const outcome = evaluateMoveOutcome({
        boardSize: match.boardSize,
        participants: match.participants,
        moves: allMoves,
        lastMove: nextMove,
        lastMoveSeat: validation.participant.seat,
      });
      const finishedAt = outcome.finished ? new Date() : null;
      const matchUpdate = outcome.finished
        ? {
            stateVersion: validation.nextStateVersion,
            status: MatchStatus.FINISHED,
            nextTurnSeat: null,
            winningSeat: outcome.winningSeat,
            endReason: outcome.endReason,
            finishedAt,
          }
        : {
            stateVersion: validation.nextStateVersion,
            nextTurnSeat: outcome.nextTurnSeat,
          };

      const guardedTransition = await tx.match.updateMany({
        where: {
          id: matchId,
          status: MatchStatus.IN_PROGRESS,
          stateVersion: match.stateVersion,
          nextTurnSeat: validation.participant.seat,
        },
        data: matchUpdate,
      });

      if (guardedTransition.count !== 1) {
        return {
          kind: "error" as const,
          payload: { error: "stale_state", status: 409 },
        };
      }

      const move = await tx.matchMove.create({
        data: {
          matchId,
          participantId: validation.participant.id,
          moveNumber,
          x: position.x,
          y: position.y,
          requestId,
          baseVersion,
          stateVersion: validation.nextStateVersion,
        },
      });

      if (outcome.finished) {
        await Promise.all(
          outcome.participantResults.map((participantResult) =>
            tx.matchParticipant.update({
              where: { id: participantResult.participantId },
              data: { result: participantResult.result },
            }),
          ),
        );
      }

      return {
        kind: "ok" as const,
        payload: {
          match: { ...match, ...matchUpdate },
          move,
          participants: match.participants,
          allMoves: [...match.moves, move],
        },
      };
    });

    if (result.kind === "error") {
      return Response.json({ error: result.payload.error }, { status: result.payload.status });
    }

    if (result.payload.match.status === MatchStatus.FINISHED) {
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
      moves: result.payload.allMoves,
      lastMove: result.payload.move,
    });

    // Try to publish the realtime update, but do NOT surface publish failures
    // as a move submission failure. This avoids the client retrying a move
    // that was already persisted.
    try {
      const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);
      await publishGameUpdate(gameUpdate, timeoutMs);
      // Note: we intentionally await here to keep ordering guarantees for
      // connected clients; if you prefer fire-and-forget, call without await.
    } catch (publishError) {
      console.error(`[matches/${matchId}] realtime publish failed:`, getErrorMessage(publishError));
      // TODO: persist the failed broadcast to an outbox table or enqueue for retry.
      // For now we swallow the error so the client receives the accepted move.
    }

    return Response.json({
      ok: true,
      accepted: true,
      requestId: result.payload.move.requestId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: mapUniqueConstraintError(error),
          detail: getErrorMessage(error),
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        error: "failed_to_submit_move",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
