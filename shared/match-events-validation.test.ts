import { describe, expect, test } from "bun:test";

import { isGameUpdatePayload } from "./match-events-validation";

const basePayload = {
  matchId: "match-1",
  status: "IN_PROGRESS",
  visibility: "PUBLIC",
  boardSize: 2,
  stateVersion: 2,
  nextTurnSeat: "WHITE",
  winningSeat: null,
  endReason: null,
  participants: [
    {
      participantId: "black-player",
      displayName: "Black Player",
      role: "PLAYER",
      seat: "BLACK",
    },
    {
      participantId: "white-player",
      displayName: "White Player",
      role: "PLAYER",
      seat: "WHITE",
    },
  ],
  board: [
    [{ occupied: true, seat: "WHITE", moveNumber: 1 }, { occupied: false }],
    [{ occupied: false }, { occupied: true, seat: "BLACK", moveNumber: 2 }],
  ],
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

  test("accepts status updates with a null lastMove and full state", () => {
    expect(
      isGameUpdatePayload({
        ...basePayload,
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

  test("rejects payloads missing the board field", () => {
    const payload = { ...basePayload, lastMove: null } as Record<string, unknown>;
    delete payload["board"];

    expect(isGameUpdatePayload(payload)).toBe(false);
  });

  test("rejects malformed board cells", () => {
    expect(
      isGameUpdatePayload({
        ...basePayload,
        lastMove: null,
        board: [[{ occupied: true, seat: "RED", moveNumber: 1 }]],
      }),
    ).toBe(false);
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
