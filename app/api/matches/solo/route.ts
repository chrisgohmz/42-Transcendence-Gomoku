import { MatchStatus, MatchVisibility, Role, Seat } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { getAiDifficulty } from "@/lib/matches/ai-difficulty";
import { chooseAiMove, type AiMoveChoice } from "@/lib/matches/ai-engine";
import { createSoloMatchMetadata, getAiDisplayName } from "@/lib/matches/ai-solo";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { evaluateMoveOutcome, standardGomokuBoardSize } from "@/lib/matches/move-rules";
import { publishGameUpdate } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

type SoloMatchRequestBody = {
  difficulty?: unknown;
  playerSeat?: unknown;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function readBody(request: Request): Promise<SoloMatchRequestBody> {
  const body = await request.json().catch(() => ({}));
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body : {};
}

function getPlayerSeat(value: unknown): Seat {
  return value === Seat.WHITE ? Seat.WHITE : Seat.BLACK;
}

function oppositeSeat(seat: Seat): Seat {
  return seat === Seat.BLACK ? Seat.WHITE : Seat.BLACK;
}

export async function POST(request: Request) {
  const requestGuardResponse = enforceMutationRequest(request, { requireJson: true });

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const context = await getCurrentSession();

  if (!context) {
    return Response.json(
      {
        error: "unauthorized",
        message: "You need to sign in before starting a solo match.",
      },
      { status: 401 },
    );
  }

  try {
    const rateLimitExceededResponse = await enforceRateLimit(
      request.headers,
      rateLimitRule("matchSolo", userRateLimitSubject(context.user.id)),
    );

    if (rateLimitExceededResponse) {
      return rateLimitExceededResponse;
    }

    const body = await readBody(request);
    const difficulty = getAiDifficulty(body.difficulty);
    const playerSeat = getPlayerSeat(body.playerSeat);
    const aiSeat = oppositeSeat(playerSeat);

    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
          boardSize: standardGomokuBoardSize,
          createdByUserId: context.user.id,
          metadata: createSoloMatchMetadata(difficulty.id),
          nextTurnSeat: Seat.BLACK,
          startedAt: new Date(),
          status: MatchStatus.IN_PROGRESS,
          visibility: MatchVisibility.PRIVATE,
          participants: {
            create: [
              {
                displayNameSnapshot: context.user.displayName || context.user.username,
                role: Role.PLAYER,
                seat: playerSeat,
                userId: context.user.id,
              },
              {
                displayNameSnapshot: getAiDisplayName(),
                role: Role.PLAYER,
                seat: aiSeat,
                userId: null,
              },
            ],
          },
        },
        include: {
          moves: {
            orderBy: { moveNumber: "asc" },
          },
          participants: {
            orderBy: { joinedAt: "asc" },
          },
        },
      });
      const humanParticipant = match.participants.find(
        (participant) => participant.userId === context.user.id,
      );
      const aiParticipant = match.participants.find(
        (participant) => participant.userId === null && participant.seat === aiSeat,
      );

      if (!humanParticipant || !aiParticipant || !aiParticipant.seat) {
        throw new Error("Solo match participants were not created.");
      }

      let updatedMatch = match;
      let allMoves = match.moves;
      let aiOpening: AiMoveChoice | null = null;

      if (aiSeat === Seat.BLACK) {
        aiOpening = chooseAiMove({
          aiParticipantId: aiParticipant.id,
          boardSize: match.boardSize,
          difficultyId: difficulty.id,
          moves: [],
          participants: match.participants,
        });
        const nextStateVersion = match.stateVersion + 1;
        const nextMove = {
          participantId: aiParticipant.id,
          moveNumber: 1,
          x: aiOpening.position.x,
          y: aiOpening.position.y,
        };
        const outcome = evaluateMoveOutcome({
          boardSize: match.boardSize,
          lastMove: nextMove,
          lastMoveSeat: aiParticipant.seat,
          moves: [nextMove],
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

        updatedMatch = await tx.match.update({
          where: { id: match.id },
          data: matchUpdate,
          include: {
            moves: {
              orderBy: { moveNumber: "asc" },
            },
            participants: {
              orderBy: { joinedAt: "asc" },
            },
          },
        });

        const move = await tx.matchMove.create({
          data: {
            baseVersion: match.stateVersion,
            matchId: match.id,
            moveNumber: 1,
            participantId: aiParticipant.id,
            requestId: `ai-opening:${match.id}`,
            stateVersion: nextStateVersion,
            x: aiOpening.position.x,
            y: aiOpening.position.y,
          },
        });
        allMoves = [move];
      }

      return {
        aiOpening,
        difficultyId: difficulty.id,
        humanParticipant,
        match: updatedMatch,
        moves: allMoves,
        participants: updatedMatch.participants,
      };
    });

    const gameUpdate = buildGameUpdatePayload({
      match: result.match,
      moves: result.moves,
      participants: result.participants,
    });

    try {
      const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);
      await publishGameUpdate(gameUpdate, timeoutMs);
    } catch (publishError) {
      console.error(
        `[matches/${result.match.id}] realtime publish failed:`,
        getErrorMessage(publishError),
      );
    }

    return Response.json({
      aiOpening: result.aiOpening
        ? {
            position: result.aiOpening.position,
            reason: result.aiOpening.reason,
          }
        : null,
      difficulty: result.difficultyId,
      matchId: result.match.id,
      participantId: result.humanParticipant.id,
      role: result.humanParticipant.role,
      seat: result.humanParticipant.seat,
      stateVersion: result.match.stateVersion,
      status: result.match.status,
    });
  } catch (error) {
    console.error("[api/matches/solo] create failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_create_solo_match",
      },
      { status: 500 },
    );
  }
}
