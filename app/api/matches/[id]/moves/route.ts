import { Prisma, MatchParticipant } from "@/../generated/prisma/client";
import { buildBoard } from "@/lib/game/state-builder";
import { validateMoveSubmission, type Position } from "@/lib/matches/move-rules";
import { prisma } from "@/lib/prisma";

import type { GameUpdatePayload } from "../../../../../shared/match-events";

export const dynamic = "force-dynamic";

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

async function publishGameUpdate(
  payload: GameUpdatePayload,
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  const realtimeInternalUrl =
    process.env["REALTIME_INTERNAL_URL"] ?? "http://realtime:3001/internal/game-update";

  // Allow caller to provide a short timeout so publish doesn't block the request.
  // On failure we throw so callers can decide how to handle it.
  async function doFetch(ms: number) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(realtimeInternalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to publish game:update(${response.status})`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return doFetch(timeoutMs);
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

      const validation = validateMoveSubmission({
        match,
        participantId,
        position,
        baseVersion,
        hasDuplicateRequest: duplicateRequestMove !== null,
        isOccupied: occupiedMove !== null,
      });

      if (!validation.ok) {
        return {
          kind: "error" as const,
          payload: { error: validation.error, status: validation.status },
        };
      }

      const moveCount = await tx.matchMove.count({
        where: { matchId },
      });

      const move = await tx.matchMove.create({
        data: {
          matchId,
          participantId: validation.participant.id,
          moveNumber: moveCount + 1,
          x: position.x,
          y: position.y,
          requestId,
          baseVersion,
          stateVersion: validation.nextStateVersion,
        },
      });

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          stateVersion: validation.nextStateVersion,
          nextTurnSeat: validation.nextTurnSeat,
        },
      });

      return {
        kind: "ok" as const,
        payload: {
          match: updatedMatch,
          move,
          participants: match.participants,
          allmoves: [...match.moves, move],
        },
      };
    });

    if (result.kind === "error") {
      return Response.json({ error: result.payload.error }, { status: result.payload.status });
    }

    const board = buildBoard(
      result.payload.match.boardSize,
      result.payload.participants,
      result.payload.allmoves,
    );

    const gameUpdate: GameUpdatePayload = {
      matchId,
      status: result.payload.match.status,
      visibility: result.payload.match.visibility,
      boardSize: result.payload.match.boardSize,
      stateVersion: result.payload.match.stateVersion,
      nextTurnSeat: result.payload.match.nextTurnSeat,
      winningSeat: result.payload.match.winningSeat,
      endReason: result.payload.match.endReason,
      participants: result.payload.participants.map((p: MatchParticipant) => ({
        participantId: p.id,
        displayName: p.displayNameSnapshot,
        role: p.role,
        seat: p.seat,
      })),
      board,
      lastMove: {
        moveNumber: result.payload.move.moveNumber,
        participantId: result.payload.move.participantId,
        position,
        requestId: result.payload.move.requestId,
        stateVersion: result.payload.move.stateVersion,
      },
    };

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
