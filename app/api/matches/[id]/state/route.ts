import { buildBoard } from "@/lib/game/state-builder";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: matchId } = await params;

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

    const board = buildBoard(match.boardSize, match.participants, match.moves);

    return Response.json({
      matchId: match.id,
      status: match.status,
      visibility: match.visibility,
      boardSize: match.boardSize,
      stateVersion: match.stateVersion,
      nextTurnSeat: match.nextTurnSeat,
      winningSeat: match.winningSeat,
      endReason: match.endReason,
      createdByUserId: match.createdByUserId,
      participants: match.participants.map((participant) => ({
        participantId: participant.id,
        userId: participant.userId,
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
