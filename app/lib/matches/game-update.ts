import type { Match, MatchMove, MatchParticipant } from "@/../generated/prisma/client";
import { buildBoard } from "@/lib/game/state-builder";

import type { GameUpdatePayload, LastMove } from "../../../shared/match-events";

type GameUpdateMatch = Pick<
  Match,
  | "boardSize"
  | "endReason"
  | "id"
  | "nextTurnSeat"
  | "stateVersion"
  | "status"
  | "visibility"
  | "winningSeat"
>;

type GameUpdateParticipant = Pick<MatchParticipant, "displayNameSnapshot" | "id" | "role" | "seat">;

type GameUpdateMove = Pick<
  MatchMove,
  "moveNumber" | "participantId" | "requestId" | "stateVersion" | "x" | "y"
>;

function toLastMove(move: GameUpdateMove | null): LastMove | null {
  if (!move) {
    return null;
  }

  return {
    moveNumber: move.moveNumber,
    participantId: move.participantId,
    position: { x: move.x, y: move.y },
    requestId: move.requestId,
    stateVersion: move.stateVersion,
  };
}

export function buildGameUpdatePayload({
  match,
  participants,
  moves,
  lastMove,
}: {
  match: GameUpdateMatch;
  participants: GameUpdateParticipant[];
  moves: GameUpdateMove[];
  lastMove?: GameUpdateMove | null;
}): GameUpdatePayload {
  const sortedMoves = [...moves].sort((a, b) => a.moveNumber - b.moveNumber);
  const latestMove = lastMove ?? sortedMoves.at(-1) ?? null;

  return {
    matchId: match.id,
    status: match.status,
    visibility: match.visibility,
    boardSize: match.boardSize,
    stateVersion: match.stateVersion,
    nextTurnSeat: match.nextTurnSeat,
    winningSeat: match.winningSeat,
    endReason: match.endReason,
    participants: participants.map((participant) => ({
      participantId: participant.id,
      displayName: participant.displayNameSnapshot,
      role: participant.role,
      seat: participant.seat,
    })),
    board: buildBoard(match.boardSize, participants, sortedMoves),
    lastMove: toLastMove(latestMove),
  };
}
