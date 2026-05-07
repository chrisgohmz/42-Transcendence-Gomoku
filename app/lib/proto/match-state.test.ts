import { describe, expect, test } from "bun:test";

import {
  getGameUpdateForSession,
  getSessionSeat,
  type MatchStateResponse,
  toInitialGameUpdate,
} from "./match-state";

const state: MatchStateResponse = {
  matchId: "match-1",
  status: "IN_PROGRESS",
  visibility: "PUBLIC",
  boardSize: 2,
  stateVersion: 3,
  nextTurnSeat: "WHITE",
  winningSeat: null,
  endReason: null,
  participants: [
    {
      participantId: "black-player",
      displayName: "Black",
      role: "PLAYER",
      seat: "BLACK",
      joinedAt: "2026-05-07T00:00:00.000Z",
      leftAt: null,
    },
    {
      participantId: "white-player",
      displayName: "White",
      role: "PLAYER",
      seat: "WHITE",
      joinedAt: "2026-05-07T00:00:01.000Z",
      leftAt: null,
    },
  ],
  moves: [
    {
      moveNumber: 1,
      participantId: "black-player",
      position: { x: 0, y: 0 },
      requestId: "request-1",
      baseVersion: 0,
      stateVersion: 1,
    },
    {
      moveNumber: 2,
      participantId: "white-player",
      position: { x: 1, y: 0 },
      requestId: "request-2",
      baseVersion: 1,
      stateVersion: 2,
    },
  ],
  board: [
    [
      { occupied: true, seat: "BLACK", moveNumber: 1 },
      { occupied: true, seat: "WHITE", moveNumber: 2 },
    ],
    [{ occupied: false }, { occupied: false }],
  ],
};

describe("match state helpers", () => {
  test("does not reuse restored state for a different active match", () => {
    const update = toInitialGameUpdate(state, {
      matchId: "match-2",
      participantId: "black-player",
    });

    expect(update).toBeNull();
    expect(getSessionSeat(state, { matchId: "match-2", participantId: "black-player" })).toBeNull();
  });

  test("does not reuse live updates for a different active match", () => {
    const update = toInitialGameUpdate(state, {
      matchId: "match-1",
      participantId: "black-player",
    });

    expect(
      getGameUpdateForSession(update, { matchId: "match-2", participantId: "black-player" }),
    ).toBeNull();
  });

  test("maps restored state to the initial game update for the active match", () => {
    const update = toInitialGameUpdate(state, {
      matchId: "match-1",
      participantId: "black-player",
    });

    expect(update).toMatchObject({
      matchId: "match-1",
      stateVersion: 3,
      lastMove: {
        moveNumber: 2,
        participantId: "white-player",
      },
    });
    expect(update?.participants).toHaveLength(2);
    expect(getSessionSeat(state, { matchId: "match-1", participantId: "black-player" })).toBe(
      "BLACK",
    );
  });
});
