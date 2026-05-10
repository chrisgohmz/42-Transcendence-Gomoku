import type { Cell, GameUpdatePayload, Seat } from "../../../shared/match-events";

export type MatchSessionIdentity = {
  matchId: string;
  participantId: string;
};

export type MatchStateResponse = {
  matchId: string;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  visibility: "PUBLIC" | "PRIVATE";
  boardSize: number;
  stateVersion: number;
  nextTurnSeat: Seat | null;
  winningSeat: Seat | null;
  endReason: string | null;
  participants: Array<{
    participantId: string;
    displayName: string;
    role: "PLAYER" | "SPECTATOR";
    seat: Seat | null;
    joinedAt: string;
    leftAt: string | null;
  }>;
  moves: Array<{
    moveNumber: number;
    participantId: string;
    position: { x: number; y: number };
    requestId: string | null;
    baseVersion: number | null;
    stateVersion: number;
  }>;
  board: Cell[][];
};

export function getSessionSeat(
  state: MatchStateResponse | null,
  session: MatchSessionIdentity | null,
): Seat | null {
  if (!state || !session || state.matchId !== session.matchId) {
    return null;
  }

  return (
    state.participants.find((participant) => participant.participantId === session.participantId)
      ?.seat ?? null
  );
}

export function getGameUpdateForSession(
  update: GameUpdatePayload | null,
  session: MatchSessionIdentity | null,
): GameUpdatePayload | null {
  if (!update || !session || update.matchId !== session.matchId) {
    return null;
  }

  return update;
}

export function toInitialGameUpdate(
  state: MatchStateResponse | null,
  session: MatchSessionIdentity | null,
): GameUpdatePayload | null {
  if (!state || !session || state.matchId !== session.matchId) {
    return null;
  }

  const restoredLastMove = state.moves[state.moves.length - 1] ?? null;

  return {
    matchId: state.matchId,
    status: state.status,
    visibility: state.visibility,
    boardSize: state.boardSize,
    stateVersion: state.stateVersion,
    nextTurnSeat: state.nextTurnSeat,
    winningSeat: state.winningSeat,
    endReason: state.endReason,
    participants: state.participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName,
      role: participant.role,
      seat: participant.seat,
    })),
    lastMove: restoredLastMove
      ? {
          moveNumber: restoredLastMove.moveNumber,
          participantId: restoredLastMove.participantId,
          position: restoredLastMove.position,
          requestId: restoredLastMove.requestId,
          stateVersion: restoredLastMove.stateVersion,
        }
      : null,
    board: state.board,
  };
}
