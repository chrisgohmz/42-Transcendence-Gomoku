import { describe, expect, test } from "bun:test";

import { isGameUpdatePayload } from "./match-events-validation";

const basePayload = {
  matchId: "match-1",
  status: "IN_PROGRESS",
  stateVersion: 2,
  nextTurnSeat: "WHITE",
};

describe("isGameUpdatePayload", () => {
  test("accepts a move update", () => {
    expect(
      isGameUpdatePayload({
        ...basePayload,
        lastMove: {
          moveNumber: 2,
          participantId: "black-player",
          position: { x: 3, y: 4 },
          requestId: "request-1",
          stateVersion: 2,
        },
      }),
    ).toBe(true);
  });

  test("accepts status-only updates with a null lastMove", () => {
    expect(
      isGameUpdatePayload({
        matchId: "match-1",
        status: "CANCELLED",
        stateVersion: 3,
        nextTurnSeat: null,
        lastMove: null,
      }),
    ).toBe(true);
  });

  test("rejects payloads missing the lastMove field", () => {
    expect(isGameUpdatePayload(basePayload)).toBe(false);
  });

  test("rejects malformed move positions", () => {
    expect(
      isGameUpdatePayload({
        ...basePayload,
        lastMove: {
          moveNumber: 2,
          participantId: "black-player",
          position: { x: 3.5, y: 4 },
          requestId: null,
          stateVersion: 2,
        },
      }),
    ).toBe(false);
  });
});
