import { z } from "zod";

import type { GameUpdatePayload, MatchSubscribePayload } from "./match-events";

const seatSchema = z.enum(["BLACK", "WHITE"]);
const matchStatusSchema = z.enum(["WAITING", "IN_PROGRESS", "FINISHED", "CANCELLED"]);
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
  lastMove: lastMoveSchema.nullable(),
  matchId: z.string(),
  nextTurnSeat: seatSchema.nullable(),
  stateVersion: z.number().int(),
  status: matchStatusSchema,
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
