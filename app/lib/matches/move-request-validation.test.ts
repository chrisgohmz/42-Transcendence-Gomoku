import { describe, expect, test } from "bun:test";

import { submitMoveRequestSchema } from "./move-request-validation";

describe("submitMoveRequestSchema", () => {
  test("accepts first-move payloads with a null base version", () => {
    const result = submitMoveRequestSchema.safeParse({
      baseVersion: null,
      participantId: "black-player",
      position: { x: 3, y: 4 },
      requestId: "request-1",
    });

    expect(result).toMatchObject({
      data: {
        baseVersion: null,
        participantId: "black-player",
        position: { x: 3, y: 4 },
        requestId: "request-1",
      },
      success: true,
    });
  });

  test("accepts omitted optional idempotency fields", () => {
    const result = submitMoveRequestSchema.safeParse({
      participantId: "black-player",
      position: { x: 3, y: 4 },
    });

    expect(result).toMatchObject({
      data: {
        participantId: "black-player",
        position: { x: 3, y: 4 },
      },
      success: true,
    });
  });

  test("rejects fractional base versions", () => {
    const result = submitMoveRequestSchema.safeParse({
      baseVersion: 1.5,
      participantId: "black-player",
      position: { x: 3, y: 4 },
      requestId: "request-1",
    });

    expect(result.success).toBe(false);
  });

  test("rejects coordinates outside the database integer range", () => {
    const result = submitMoveRequestSchema.safeParse({
      participantId: "black-player",
      position: { x: 2_147_483_648, y: 4 },
    });

    expect(result.success).toBe(false);
  });

  test("rejects negative coordinates before route processing", () => {
    const result = submitMoveRequestSchema.safeParse({
      participantId: "black-player",
      position: { x: -1, y: 4 },
    });

    expect(result.success).toBe(false);
  });
});
