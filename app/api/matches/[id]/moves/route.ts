import { Prisma } from "@/../generated/prisma/client";
import { MatchStatus, Role, Seat } from "@/../generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { GameUpdatePayload } from "@/shared/match-events";

export const dynamic = "force-dynamic";

type Position = {
  x: number;
  y: number;
};

type SubmitMoveRequest = {
  participantId?: string;
  position?: {
    x?: number;
    y?: number;
  };
  requestId?: string;
  baseVersion?: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isValidPosition(value: SubmitMoveRequest["position"]): value is Position {
  return (
    typeof value?.x === "number" &&
    Number.isInteger(value.x) &&
    typeof value?.y === "number" &&
    Number.isInteger(value.y)
  );
}

async function publishGameUpdate(payload: GameUpdatePayload) {
  const realtimeInternalUrl =
    process.env["REALTIME_INTERNAL_URL"] ?? "http://realtime:3001/internal/game-update";

  const response = await fetch(realtimeInternalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to publish game:update(${response.status})`);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: matchId } = await params;
    const body = (await request.json()) as SubmitMoveRequest;

    if (!body.participantId || !isValidPosition(body.position)) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const participantId = body.participantId;
    const position = body.position;
    const requestId = typeof body.requestId === "string" ? body.requestId : null;
    const baseVersion = typeof body.baseVersion === "number" ? body.baseVersion : null;

    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { participants: true },
      });

      if (!match) {
        return {
          kind: "error" as const,
          payload: { error: "match_not_found", status: 404 },
        };
      }

      if (match.status !== MatchStatus.IN_PROGRESS) {
        return {
          kind: "error" as const,
          payload: { error: "game_not_started", status: 409 },
        };
      }

      const participant = match.participants.find((item) => item.id === participantId);

      if (!participant || participant.role !== Role.PLAYER) {
        return {
          kind: "error" as const,
          payload: { error: "not_a_player", status: 403 },
        };
      }

      const moveCount = await tx.matchMove.count({
        where: { matchId },
      });

      const nextStateVersion = match.stateVersion + 1;
      const nextTurnSeat =
        participant.seat === Seat.BLACK
          ? Seat.WHITE
          : participant.seat === Seat.WHITE
            ? Seat.BLACK
            : match.nextTurnSeat;

      const move = await tx.matchMove.create({
        data: {
          matchId,
          participantId: participant.id,
          moveNumber: moveCount + 1,
          x: position.x,
          y: position.y,
          requestId,
          baseVersion,
          stateVersion: nextStateVersion,
        },
      });

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          stateVersion: nextStateVersion,
          nextTurnSeat,
        },
      });

      return {
        kind: "ok" as const,
        payload: {
          match: updatedMatch,
          move,
        },
      };
    });

    if (result.kind === "error") {
      return Response.json({ error: result.payload.error }, { status: result.payload.status });
    }

    const gameUpdate: GameUpdatePayload = {
      matchId,
      status: result.payload.match.status,
      stateVersion: result.payload.match.stateVersion,
      nextTurnSeat: result.payload.match.nextTurnSeat,
      lastMove: {
        moveNumber: result.payload.move.moveNumber,
        participantId: result.payload.move.participantId,
        position,
        requestId: result.payload.move.requestId,
        stateVersion: result.payload.move.stateVersion,
      },
    };

    await publishGameUpdate(gameUpdate);

    return Response.json({
      ok: true,
      accepted: true,
      requesteId: result.payload.move.requestId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "move_conflict",
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
