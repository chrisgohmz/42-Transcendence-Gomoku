import { z } from "zod";

import { MatchResult, MatchStatus, Role, Seat } from "../../../generated/prisma/enums";

const maxPrismaInt = 2_147_483_647;
export const standardGomokuBoardSize = 15;
export const gomokuWinLength = 5;
export const endReasonFiveInARow = "five_in_a_row";
export const endReasonDraw = "draw";
export const endReasonResign = "resign";

export const positionSchema = z.object({
  x: z.number().int().min(0).max(maxPrismaInt),
  y: z.number().int().min(0).max(maxPrismaInt),
});

export type Position = z.infer<typeof positionSchema>;
export type TerminalEndReason =
  | typeof endReasonFiveInARow
  | typeof endReasonDraw
  | typeof endReasonResign;

export type MoveParticipant = {
  id: string;
  role: Role;
  seat: Seat | null;
};

export type MoveSnapshot = {
  participantId: string;
  moveNumber: number;
  x: number;
  y: number;
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

type MoveValidationError = {
  ok: false;
  error: MoveErrorCode;
  status: number;
};

export type MoveValidationResult =
  | {
      ok: true;
      participant: MoveParticipant & { seat: Seat };
      nextStateVersion: number;
      nextTurnSeat: Seat;
    }
  | MoveValidationError;

export type ParticipantResultUpdate = {
  participantId: string;
  result: MatchResult;
};

export type FinishedMatchTransition = {
  status: typeof MatchStatus.FINISHED;
  nextTurnSeat: null;
  winningSeat: Seat | null;
  endReason: TerminalEndReason;
  participantResults: ParticipantResultUpdate[];
};

export type MoveOutcome =
  | {
      finished: false;
      nextTurnSeat: Seat;
    }
  | ({
      finished: true;
    } & FinishedMatchTransition);

export type ResignationValidationResult =
  | {
      ok: true;
      participant: MoveParticipant & { seat: Seat };
      nextStateVersion: number;
      transition: FinishedMatchTransition;
    }
  | MoveValidationError;

type MoveValidationInput = {
  match: MoveMatchSnapshot;
  participantId: string;
  position: Position;
  baseVersion: number | null;
  hasDuplicateRequest: boolean;
  isOccupied: boolean;
};

type ResignationValidationInput = {
  match: MoveMatchSnapshot;
  participantId: string;
  baseVersion: number | null;
};

type MoveOutcomeInput = {
  boardSize: number;
  participants: MoveParticipant[];
  moves: MoveSnapshot[];
  lastMove: MoveSnapshot;
  lastMoveSeat: Seat;
};

const moveParticipantSchema = z.object({
  id: z.string(),
  role: z.enum(Role),
  seat: z.enum(Seat).nullable(),
});

const moveMatchSnapshotSchema = z.object({
  boardSize: z.number().int(),
  nextTurnSeat: z.enum(Seat).nullable(),
  participants: z.array(moveParticipantSchema),
  stateVersion: z.number().int(),
  status: z.enum(MatchStatus),
});

const moveValidationInputSchema = z.object({
  baseVersion: z.number().int().nullable(),
  hasDuplicateRequest: z.boolean(),
  isOccupied: z.boolean(),
  match: moveMatchSnapshotSchema,
  participantId: z.string(),
  position: positionSchema,
});

const resignationValidationInputSchema = z.object({
  baseVersion: z.number().int().nullable(),
  match: moveMatchSnapshotSchema,
  participantId: z.string(),
});

function error(errorCode: MoveErrorCode, status: number): MoveValidationError {
  return { ok: false, error: errorCode, status };
}

function resignationError(errorCode: MoveErrorCode, status: number): MoveValidationError {
  return { ok: false, error: errorCode, status };
}

function isKnownSeat(seat: Seat | null): seat is Seat {
  return seat === Seat.BLACK || seat === Seat.WHITE;
}

function asPlayerWithSeat(participant: MoveParticipant | undefined) {
  if (!participant || participant.role !== Role.PLAYER || !isKnownSeat(participant.seat)) {
    return null;
  }

  return {
    ...participant,
    seat: participant.seat,
  };
}

function nextSeatAfter(seat: Seat): Seat {
  return seat === Seat.BLACK ? Seat.WHITE : Seat.BLACK;
}

function statusError(status: MatchStatus): MoveValidationError | null {
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

function positionKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function participantSeatById(participants: MoveParticipant[]) {
  const seats = new Map<string, Seat>();

  for (const participant of participants) {
    if (isKnownSeat(participant.seat)) {
      seats.set(participant.id, participant.seat);
    }
  }

  return seats;
}

function occupiedSeatsByPosition(
  boardSize: number,
  participants: MoveParticipant[],
  moves: MoveSnapshot[],
) {
  const seatsByParticipantId = participantSeatById(participants);
  const occupiedSeats = new Map<string, Seat>();

  for (const move of moves) {
    const seat = seatsByParticipantId.get(move.participantId);
    if (!seat || !isPositionOnBoard(move, boardSize)) {
      continue;
    }

    occupiedSeats.set(positionKey(move.x, move.y), seat);
  }

  return occupiedSeats;
}

function countContiguousSeats(
  occupiedSeats: Map<string, Seat>,
  start: Position,
  seat: Seat,
  dx: number,
  dy: number,
): number {
  let count = 0;
  let x = start.x + dx;
  let y = start.y + dy;

  while (occupiedSeats.get(positionKey(x, y)) === seat) {
    count += 1;
    x += dx;
    y += dy;
  }

  return count;
}

function hasFiveInARow(occupiedSeats: Map<string, Seat>, position: Position, seat: Seat): boolean {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const;

  return directions.some(([dx, dy]) => {
    const total =
      1 +
      countContiguousSeats(occupiedSeats, position, seat, dx, dy) +
      countContiguousSeats(occupiedSeats, position, seat, -dx, -dy);

    return total >= gomokuWinLength;
  });
}

function buildParticipantResults(
  participants: MoveParticipant[],
  winningSeat: Seat | null,
): ParticipantResultUpdate[] {
  const results: ParticipantResultUpdate[] = [];

  for (const participant of participants) {
    if (participant.role !== Role.PLAYER || !isKnownSeat(participant.seat)) {
      continue;
    }

    if (winningSeat === null) {
      results.push({ participantId: participant.id, result: MatchResult.DRAW });
      continue;
    }

    results.push({
      participantId: participant.id,
      result: participant.seat === winningSeat ? MatchResult.WIN : MatchResult.LOSS,
    });
  }

  return results;
}

function finishedTransition(
  participants: MoveParticipant[],
  winningSeat: Seat | null,
  endReason: TerminalEndReason,
): FinishedMatchTransition {
  return {
    status: MatchStatus.FINISHED,
    nextTurnSeat: null,
    winningSeat,
    endReason,
    participantResults: buildParticipantResults(participants, winningSeat),
  };
}

export function validateMoveSubmission(input: MoveValidationInput): MoveValidationResult {
  const parsedInput = moveValidationInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return error("invalid_position", 400);
  }

  const moveInput = parsedInput.data;
  const statusValidation = statusError(moveInput.match.status);
  if (statusValidation) {
    return statusValidation;
  }

  const participant = moveInput.match.participants.find(
    (item) => item.id === moveInput.participantId,
  );
  const playerParticipant = asPlayerWithSeat(participant);
  if (!playerParticipant) {
    return error("not_a_player", 403);
  }

  if (moveInput.hasDuplicateRequest) {
    return error("duplicate_request", 409);
  }

  if (!isPositionOnBoard(moveInput.position, moveInput.match.boardSize)) {
    return error("invalid_position", 400);
  }

  if (moveInput.baseVersion !== null && moveInput.baseVersion !== moveInput.match.stateVersion) {
    return error("stale_state", 409);
  }

  if (playerParticipant.seat !== moveInput.match.nextTurnSeat) {
    return error("not_your_turn", 409);
  }

  if (moveInput.isOccupied) {
    return error("occupied", 409);
  }

  return {
    ok: true,
    participant: playerParticipant,
    nextStateVersion: moveInput.match.stateVersion + 1,
    nextTurnSeat: nextSeatAfter(playerParticipant.seat),
  };
}

export function evaluateMoveOutcome({
  boardSize,
  participants,
  moves,
  lastMove,
  lastMoveSeat,
}: MoveOutcomeInput): MoveOutcome {
  const occupiedSeats = occupiedSeatsByPosition(boardSize, participants, moves);
  const lastMovePosition = { x: lastMove.x, y: lastMove.y };

  if (hasFiveInARow(occupiedSeats, lastMovePosition, lastMoveSeat)) {
    return {
      finished: true,
      ...finishedTransition(participants, lastMoveSeat, endReasonFiveInARow),
    };
  }

  if (moves.length >= boardSize * boardSize) {
    return {
      finished: true,
      ...finishedTransition(participants, null, endReasonDraw),
    };
  }

  return {
    finished: false,
    nextTurnSeat: nextSeatAfter(lastMoveSeat),
  };
}

export function validateResignation(
  input: ResignationValidationInput,
): ResignationValidationResult {
  const parsedInput = resignationValidationInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return resignationError("invalid_position", 400);
  }

  const resignationInput = parsedInput.data;
  const statusValidation = statusError(resignationInput.match.status);
  if (statusValidation) {
    return resignationError(statusValidation.error, statusValidation.status);
  }

  const participant = resignationInput.match.participants.find(
    (item) => item.id === resignationInput.participantId,
  );
  const playerParticipant = asPlayerWithSeat(participant);
  if (!playerParticipant) {
    return resignationError("not_a_player", 403);
  }

  if (
    resignationInput.baseVersion !== null &&
    resignationInput.baseVersion !== resignationInput.match.stateVersion
  ) {
    return resignationError("stale_state", 409);
  }

  return {
    ok: true,
    participant: playerParticipant,
    nextStateVersion: resignationInput.match.stateVersion + 1,
    transition: finishedTransition(
      resignationInput.match.participants,
      nextSeatAfter(playerParticipant.seat),
      endReasonResign,
    ),
  };
}
