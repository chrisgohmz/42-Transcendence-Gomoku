import { z } from "zod";

import { positionSchema } from "./move-rules";

export const submitMoveRequestSchema = z.object({
  baseVersion: z.number().int().nullable().optional(),
  participantId: z.string().min(1),
  position: positionSchema,
  requestId: z.string().nullable().optional(),
});

export type SubmitMoveRequest = z.infer<typeof submitMoveRequestSchema>;
