import { getCurrentSession } from "@/lib/auth";
import { buildBoard } from "@/lib/game/state-builder";
import { getSoloMatchMetadata } from "@/lib/matches/ai-solo";
import { isActiveParticipantForUser } from "@/lib/matches/participant-access";
import { prisma } from "@/lib/prisma";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id: matchId } = await params;
    const participantId = new URL(request.url).searchParams.get("participantId");

    if (!participantId) {
      return Response.json({ error: "missing_participant_id" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        moves: {
          orderBy: { moveNumber: "asc" },
        },
      },
    });

    if (!match) {
      return Response.json({ error: "match_not_found" }, { status: 404 });
    }

    if (!isActiveParticipantForUser(match.participants, participantId, context.user.id)) {
      return Response.json({ error: "participant_not_found" }, { status: 403 });
    }

    const board = buildBoard(match.boardSize, match.participants, match.moves);
    const soloMetadata = getSoloMatchMetadata(match.metadata);

    return Response.json({
      ...(soloMetadata
        ? {
            aiDifficulty: soloMetadata.aiDifficulty,
            mode: soloMetadata.mode,
          }
        : {}),
      matchId: match.id,
      status: match.status,
      visibility: match.visibility,
      boardSize: match.boardSize,
      stateVersion: match.stateVersion,
      nextTurnSeat: match.nextTurnSeat,
      winningSeat: match.winningSeat,
      endReason: match.endReason,
      participants: match.participants.map((participant) => ({
        participantId: participant.id,
        displayName: participant.displayNameSnapshot,
        role: participant.role,
        seat: participant.seat,
        joinedAt: participant.joinedAt.toISOString(),
        leftAt: participant.leftAt ? participant.leftAt.toISOString() : null,
      })),
      moves: match.moves.map((move) => ({
        moveNumber: move.moveNumber,
        participantId: move.participantId,
        position: { x: move.x, y: move.y },
        requestId: move.requestId,
        baseVersion: move.baseVersion,
        stateVersion: move.stateVersion,
      })),
      board,
    });
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_load_state",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
