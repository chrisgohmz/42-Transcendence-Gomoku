import { MatchStatus, Role, Seat } from "../../../generated/prisma/enums";

export type Position = {
  x: number;
  y: number;
};

export type MoveParticipant = {
  id: string;
  role: Role;
  seat: Seat | null;
};

export type MoveMatchSnapshot = {
  status: MatchStatus;
  boardSize: number;
  stateVersion: number;
  nextTurnSeat: Seat | null;
  participants: MoveParticipant[];
};

export type MoveErrorCode =
  | "game_not_started"
  | "game_finished"
  | "match_cancelled"
  | "not_a_player"
  | "invalid_position"
  | "stale_state"
  | "not_your_turn"
  | "duplicate_request"
  | "occupied";

export type MoveValidationResult =
  | {
      ok: true;
      participant: MoveParticipant;
      nextStateVersion: number;
      nextTurnSeat: Seat;
    }
  | {
      ok: false;
      error: MoveErrorCode;
      status: number;
    };

type MoveValidationInput = {
  match: MoveMatchSnapshot;
  participantId: string;
  position: Position;
  baseVersion: number | null;
  hasDuplicateRequest: boolean;
  isOccupied: boolean;
};

function error(errorCode: MoveErrorCode, status: number): MoveValidationResult {
  return { ok: false, error: errorCode, status };
}

function isKnownSeat(seat: Seat | null): seat is Seat {
  return seat === Seat.BLACK || seat === Seat.WHITE;
}

function nextSeatAfter(seat: Seat): Seat {
  return seat === Seat.BLACK ? Seat.WHITE : Seat.BLACK;
}

function statusError(status: MatchStatus): MoveValidationResult | null {
  switch (status) {
    case MatchStatus.IN_PROGRESS:
      return null;
    case MatchStatus.FINISHED:
      return error("game_finished", 409);
    case MatchStatus.CANCELLED:
      return error("match_cancelled", 409);
    case MatchStatus.WAITING:
      return error("game_not_started", 409);
  }
}

function isPositionOnBoard(position: Position, boardSize: number): boolean {
  return (
    boardSize > 0 &&
    position.x >= 0 &&
    position.x < boardSize &&
    position.y >= 0 &&
    position.y < boardSize
  );
}

export function validateMoveSubmission(input: MoveValidationInput): MoveValidationResult {
  const statusValidation = statusError(input.match.status);
  if (statusValidation) {
    return statusValidation;
  }

  const participant = input.match.participants.find((item) => item.id === input.participantId);
  if (!participant || participant.role !== Role.PLAYER || !isKnownSeat(participant.seat)) {
    return error("not_a_player", 403);
  }

  if (input.hasDuplicateRequest) {
    return error("duplicate_request", 409);
  }

  if (!isPositionOnBoard(input.position, input.match.boardSize)) {
    return error("invalid_position", 400);
  }

  if (input.baseVersion !== null && input.baseVersion !== input.match.stateVersion) {
    return error("stale_state", 409);
  }

  if (participant.seat !== input.match.nextTurnSeat) {
    return error("not_your_turn", 409);
  }

  if (input.isOccupied) {
    return error("occupied", 409);
  }

  return {
    ok: true,
    participant,
    nextStateVersion: input.match.stateVersion + 1,
    nextTurnSeat: nextSeatAfter(participant.seat),
  };
}
