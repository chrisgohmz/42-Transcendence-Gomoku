import { Prisma } from "@/../generated/prisma/client";
import { MatchStatus, Role } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { getAiDifficulty, getAiResponseDelayMs } from "@/lib/matches/ai-difficulty";
import { chooseAiMove } from "@/lib/matches/ai-engine";
import {
  getSoloAiParticipant,
  getSoloMatchDifficultyId,
  getSoloMatchMetadata,
} from "@/lib/matches/ai-solo";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { evaluateMoveOutcome } from "@/lib/matches/move-rules";
import { isActiveParticipantForUser } from "@/lib/matches/participant-access";
import { publishGameUpdate } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { syncUserGameStatsForUser } from "@/lib/stats/result-sync";

type AiTurnRequestBody = {
  baseVersion?: unknown;
  participantId?: unknown;
};

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

async function readBody(request: Request): Promise<AiTurnRequestBody> {
  const body = await request.json().catch(() => ({}));
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body : {};
}

function getBaseVersion(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function getConfiguredDelayMs(difficulty: ReturnType<typeof getAiDifficulty>): number {
  const override = Number(process.env["AI_RESPONSE_DELAY_MS"]);

  if (Number.isFinite(override) && override >= 0) {
    return override;
  }

  return getAiResponseDelayMs(difficulty);
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id: matchId } = await params;
    const body = await readBody(request);
    const participantId = typeof body.participantId === "string" ? body.participantId : null;
    const baseVersion = getBaseVersion(body.baseVersion);

    if (!participantId) {
      return Response.json({ error: "missing_participant_id" }, { status: 400 });
    }

    const previewMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
      },
    });

    if (!previewMatch) {
      return Response.json({ error: "match_not_found" }, { status: 404 });
    }

    if (!isActiveParticipantForUser(previewMatch.participants, participantId, context.user.id)) {
      return Response.json({ error: "participant_not_found" }, { status: 403 });
    }

    const previewMetadata = getSoloMatchMetadata(previewMatch.metadata);
    const previewAiParticipant = getSoloAiParticipant(previewMatch.participants);
    if (!previewMetadata || !previewAiParticipant) {
      return Response.json({ error: "not_solo_match" }, { status: 409 });
    }

    const difficulty = getAiDifficulty(previewMetadata.aiDifficulty);
    await sleep(getConfiguredDelayMs(difficulty));

    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          moves: {
            orderBy: { moveNumber: "asc" },
          },
          participants: {
            orderBy: { joinedAt: "asc" },
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

      const soloMetadata = getSoloMatchMetadata(match.metadata);
      const aiParticipant = getSoloAiParticipant(match.participants);
      if (!soloMetadata || !aiParticipant || !aiParticipant.seat) {
        return {
          kind: "error" as const,
          payload: { error: "not_solo_match", status: 409 },
        };
      }

      if (match.status !== MatchStatus.IN_PROGRESS) {
        return {
          kind: "error" as const,
          payload: { error: "game_not_in_progress", status: 409 },
        };
      }

      if (baseVersion !== null && baseVersion !== match.stateVersion) {
        return {
          kind: "error" as const,
          payload: { error: "stale_state", status: 409 },
        };
      }

      if (match.nextTurnSeat !== aiParticipant.seat) {
        return {
          kind: "error" as const,
          payload: { error: "not_ai_turn", status: 409 },
        };
      }

      const currentDifficultyId = getSoloMatchDifficultyId(match.metadata);
      const moveChoice = chooseAiMove({
        aiParticipantId: aiParticipant.id,
        boardSize: match.boardSize,
        difficultyId: currentDifficultyId,
        moves: match.moves,
        participants: match.participants,
      });
      const nextStateVersion = match.stateVersion + 1;
      const moveNumber = match.moves.length + 1;
      const nextMove = {
        participantId: aiParticipant.id,
        moveNumber,
        x: moveChoice.position.x,
        y: moveChoice.position.y,
      };
      const allMoveSnapshots = [...match.moves, nextMove];
      const outcome = evaluateMoveOutcome({
        boardSize: match.boardSize,
        lastMove: nextMove,
        lastMoveSeat: aiParticipant.seat,
        moves: allMoveSnapshots,
        participants: match.participants,
      });
      const matchUpdate = outcome.finished
        ? {
            endReason: outcome.endReason,
            finishedAt: new Date(),
            nextTurnSeat: null,
            stateVersion: nextStateVersion,
            status: MatchStatus.FINISHED,
            winningSeat: outcome.winningSeat,
          }
        : {
            nextTurnSeat: outcome.nextTurnSeat,
            stateVersion: nextStateVersion,
          };
      const guardedTransition = await tx.match.updateMany({
        where: {
          id: matchId,
          nextTurnSeat: aiParticipant.seat,
          stateVersion: match.stateVersion,
          status: MatchStatus.IN_PROGRESS,
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
          baseVersion: match.stateVersion,
          matchId,
          moveNumber,
          participantId: aiParticipant.id,
          requestId: `ai:${matchId}:${nextStateVersion}`,
          stateVersion: nextStateVersion,
          x: moveChoice.position.x,
          y: moveChoice.position.y,
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
          moveChoice,
          moves: [...match.moves, move],
          participants: match.participants,
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
      lastMove: result.payload.move,
      match: result.payload.match,
      moves: result.payload.moves,
      participants: result.payload.participants,
    });

    try {
      const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);
      await publishGameUpdate(gameUpdate, timeoutMs);
    } catch (publishError) {
      console.error(`[matches/${matchId}] realtime publish failed:`, getErrorMessage(publishError));
    }

    return Response.json({
      accepted: true,
      move: {
        position: result.payload.moveChoice.position,
        reason: result.payload.moveChoice.reason,
        score: result.payload.moveChoice.score,
      },
      ok: true,
      stateVersion: result.payload.move.stateVersion,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          detail: getErrorMessage(error),
          error: "move_conflict",
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        detail: getErrorMessage(error),
        error: "failed_to_play_ai_turn",
      },
      { status: 500 },
    );
  }
}
