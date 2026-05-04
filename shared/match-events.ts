export type MatchSubscribePayload = {
  matchId: string;
  participantId: string;
};

export type MatchSubscribedPayload = {
  matchId: string;
};

export type Seat = "BLACK" | "WHITE";

export type Cell = { occupied: false } | { occupied: true; seat: Seat; moveNumber: number };

export type MatchStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";

export interface ParticipantSummary {
  participantId: string;
  displayName: string;
  role: "PLAYER" | "SPECTATOR";
  seat: Seat | null;
}

export interface LastMove {
  moveNumber: number;
  participantId: string;
  position: { x: number; y: number };
  requestId: string | null;
  stateVersion: number;
}

export interface GameUpdatePayload {
  matchId: string;
  status: MatchStatus;
  visibility: "PUBLIC" | "PRIVATE";
  // ruleType: "GOMOKU" | "RENJU";
  boardSize: number;
  stateVersion: number;
  nextTurnSeat: Seat | null;
  winningSeat: Seat | null;
  endReason: string | null;
  participants: ParticipantSummary[];
  lastMove: LastMove | null;
  board: Cell[][];
}
