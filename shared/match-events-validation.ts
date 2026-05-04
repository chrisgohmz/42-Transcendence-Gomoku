import { z } from "zod";

import type { GameUpdatePayload, MatchSubscribePayload } from "./match-events";

const seatSchema = z.enum(["BLACK", "WHITE"]);
const matchStatusSchema = z.enum(["WAITING", "IN_PROGRESS", "FINISHED", "CANCELLED"]);
const visibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
const participantSummarySchema = z.object({
  participantId: z.string(),
  displayName: z.string(),
  role: z.enum(["PLAYER", "SPECTATOR"]),
  seat: seatSchema.nullable(),
});
const cellSchema = z.discriminatedUnion("occupied", [
  z.object({ occupied: z.literal(false) }),
  z.object({
    occupied: z.literal(true),
    seat: seatSchema,
    moveNumber: z.number().int(),
  }),
]);
const movePositionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});
const lastMoveSchema = z.object({
  moveNumber: z.number().int(),
  participantId: z.string(),
  position: movePositionSchema,
  requestId: z.string().nullable(),
  stateVersion: z.number().int(),
});

export const gameUpdatePayloadSchema = z.object({
  board: z.array(z.array(cellSchema)),
  boardSize: z.number().int(),
  endReason: z.string().nullable(),
  lastMove: lastMoveSchema.nullable(),
  matchId: z.string(),
  nextTurnSeat: seatSchema.nullable(),
  participants: z.array(participantSummarySchema),
  stateVersion: z.number().int(),
  status: matchStatusSchema,
  visibility: visibilitySchema,
  winningSeat: seatSchema.nullable(),
});

export const matchSubscribePayloadSchema = z.object({
  matchId: z.string().min(1),
  participantId: z.string().min(1),
});

export function isGameUpdatePayload(value: unknown): value is GameUpdatePayload {
  return gameUpdatePayloadSchema.safeParse(value).success;
}

export function isMatchSubscribePayload(value: unknown): value is MatchSubscribePayload {
  return matchSubscribePayloadSchema.safeParse(value).success;
}
