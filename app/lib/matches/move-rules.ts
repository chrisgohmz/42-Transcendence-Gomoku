import { z } from "zod";

import { MatchStatus, Role, Seat } from "../../../generated/prisma/enums";

const maxPrismaInt = 2_147_483_647;

export const positionSchema = z.object({
  x: z.number().int().min(0).max(maxPrismaInt),
  y: z.number().int().min(0).max(maxPrismaInt),
});

export type Position = z.infer<typeof positionSchema>;

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
  if (!participant || participant.role !== Role.PLAYER || !isKnownSeat(participant.seat)) {
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

  if (participant.seat !== moveInput.match.nextTurnSeat) {
    return error("not_your_turn", 409);
  }

  if (moveInput.isOccupied) {
    return error("occupied", 409);
  }

  return {
    ok: true,
    participant,
    nextStateVersion: moveInput.match.stateVersion + 1,
    nextTurnSeat: nextSeatAfter(participant.seat),
  };
}
