export type MatchSubscribePayload = {
  matchId: string;
  participantId: string;
  lastSeenStateVersion?: number;
};

export type MatchSubscribedPayload = {
  matchId: string;
  stateVersion: number;
};

export type Seat = "BLACK" | "WHITE";

export type Cell = { occupied: false } | { occupied: true; seat: Seat; moveNumber: number };

export type MatchStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
export type MatchMode = "ai";
export type SharedAiDifficultyId = "beginner" | "apprentice" | "expert" | "master";

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

export interface MoveSummary extends LastMove {
  baseVersion: number | null;
}

export interface GameUpdatePayload {
  aiDifficulty?: SharedAiDifficultyId;
  matchId: string;
  mode?: MatchMode;
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
  moves: MoveSummary[];
  board: Cell[][];
}
