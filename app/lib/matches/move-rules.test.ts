import { describe, expect, test } from "bun:test";

import { MatchStatus, Role, Seat } from "../../../generated/prisma/enums";
import {
  endReasonDraw,
  endReasonFiveInARow,
  endReasonResign,
  evaluateMoveOutcome,
  validateMoveSubmission,
  validateResignation,
  type MoveMatchSnapshot,
  type MoveSnapshot,
} from "./move-rules";

function buildMatch(overrides: Partial<MoveMatchSnapshot> = {}): MoveMatchSnapshot {
  return {
    status: MatchStatus.IN_PROGRESS,
    boardSize: 15,
    stateVersion: 4,
    nextTurnSeat: Seat.BLACK,
    participants: [
      { id: "black-player", role: Role.PLAYER, seat: Seat.BLACK },
      { id: "white-player", role: Role.PLAYER, seat: Seat.WHITE },
    ],
    ...overrides,
  };
}

function move(participantId: string, moveNumber: number, x: number, y: number): MoveSnapshot {
  return { participantId, moveNumber, x, y };
}

describe("validateMoveSubmission", () => {
  test("accepts a current-turn move inside the board", () => {
    const result = validateMoveSubmission({
      match: buildMatch(),
      participantId: "black-player",
      position: { x: 3, y: 4 },
      baseVersion: 4,
      hasDuplicateRequest: false,
      isOccupied: false,
    });

    expect(result).toMatchObject({
      ok: true,
      nextStateVersion: 5,
      nextTurnSeat: Seat.WHITE,
    });
  });

  test("rejects out-of-bounds positions", () => {
    const result = validateMoveSubmission({
      match: buildMatch(),
      participantId: "black-player",
      position: { x: 15, y: 0 },
      baseVersion: 4,
      hasDuplicateRequest: false,
      isOccupied: false,
    });

    expect(result).toMatchObject({ ok: false, error: "invalid_position", status: 400 });
  });

  test("rejects stale client state", () => {
    const result = validateMoveSubmission({
      match: buildMatch(),
      participantId: "black-player",
      position: { x: 3, y: 4 },
      baseVersion: 3,
      hasDuplicateRequest: false,
      isOccupied: false,
    });

    expect(result).toMatchObject({ ok: false, error: "stale_state", status: 409 });
  });

  test("rejects the wrong participant turn", () => {
    const result = validateMoveSubmission({
      match: buildMatch(),
      participantId: "white-player",
      position: { x: 3, y: 4 },
      baseVersion: 4,
      hasDuplicateRequest: false,
      isOccupied: false,
    });

    expect(result).toMatchObject({ ok: false, error: "not_your_turn", status: 409 });
  });

  test("rejects duplicate request ids before creating another move", () => {
    const result = validateMoveSubmission({
      match: buildMatch(),
      participantId: "black-player",
      position: { x: 3, y: 4 },
      baseVersion: 4,
      hasDuplicateRequest: true,
      isOccupied: false,
    });

    expect(result).toMatchObject({ ok: false, error: "duplicate_request", status: 409 });
  });

  test("reports duplicate request ids before stale state", () => {
    const result = validateMoveSubmission({
      match: buildMatch(),
      participantId: "black-player",
      position: { x: 3, y: 4 },
      baseVersion: 3,
      hasDuplicateRequest: true,
      isOccupied: false,
    });

    expect(result).toMatchObject({ ok: false, error: "duplicate_request", status: 409 });
  });

  test("rejects occupied cells", () => {
    const result = validateMoveSubmission({
      match: buildMatch(),
      participantId: "black-player",
      position: { x: 3, y: 4 },
      baseVersion: 4,
      hasDuplicateRequest: false,
      isOccupied: true,
    });

    expect(result).toMatchObject({ ok: false, error: "occupied", status: 409 });
  });
});

describe("evaluateMoveOutcome", () => {
  test("detects a horizontal five-in-a-row victory from the last move", () => {
    const participants = buildMatch().participants;
    const moves = [
      move("black-player", 1, 3, 7),
      move("white-player", 2, 3, 8),
      move("black-player", 3, 4, 7),
      move("white-player", 4, 4, 8),
      move("black-player", 5, 5, 7),
      move("white-player", 6, 5, 8),
      move("black-player", 7, 6, 7),
      move("white-player", 8, 6, 8),
      move("black-player", 9, 7, 7),
    ];

    const result = evaluateMoveOutcome({
      boardSize: 15,
      participants,
      moves,
      lastMove: moves[8]!,
      lastMoveSeat: Seat.BLACK,
    });

    expect(result).toMatchObject({
      finished: true,
      winningSeat: Seat.BLACK,
      endReason: endReasonFiveInARow,
      nextTurnSeat: null,
      participantResults: [
        { participantId: "black-player", result: "WIN" },
        { participantId: "white-player", result: "LOSS" },
      ],
    });
  });

  test("counts overlines as wins in freestyle Gomoku", () => {
    const participants = buildMatch().participants;
    const moves = [
      move("black-player", 1, 0, 0),
      move("black-player", 2, 1, 0),
      move("black-player", 3, 2, 0),
      move("black-player", 4, 3, 0),
      move("black-player", 5, 4, 0),
      move("black-player", 6, 5, 0),
    ];

    const result = evaluateMoveOutcome({
      boardSize: 15,
      participants,
      moves,
      lastMove: moves[5]!,
      lastMoveSeat: Seat.BLACK,
    });

    expect(result).toMatchObject({
      finished: true,
      winningSeat: Seat.BLACK,
      endReason: endReasonFiveInARow,
    });
  });

  test("detects board-fill draws when no player has five stones in a row", () => {
    const participants = buildMatch().participants;
    const moves = [
      move("black-player", 1, 0, 0),
      move("white-player", 2, 1, 0),
      move("black-player", 3, 2, 0),
      move("white-player", 4, 0, 1),
      move("black-player", 5, 1, 1),
      move("white-player", 6, 2, 1),
      move("black-player", 7, 0, 2),
      move("white-player", 8, 1, 2),
      move("black-player", 9, 2, 2),
    ];

    const result = evaluateMoveOutcome({
      boardSize: 3,
      participants,
      moves,
      lastMove: moves[8]!,
      lastMoveSeat: Seat.BLACK,
    });

    expect(result).toMatchObject({
      finished: true,
      winningSeat: null,
      endReason: endReasonDraw,
      participantResults: [
        { participantId: "black-player", result: "DRAW" },
        { participantId: "white-player", result: "DRAW" },
      ],
    });
  });
});

describe("validateResignation", () => {
  test("finishes an in-progress match in favor of the opponent", () => {
    const result = validateResignation({
      match: buildMatch({ stateVersion: 8 }),
      participantId: "black-player",
      baseVersion: 8,
    });

    expect(result).toMatchObject({
      ok: true,
      nextStateVersion: 9,
      transition: {
        winningSeat: Seat.WHITE,
        endReason: endReasonResign,
        nextTurnSeat: null,
        participantResults: [
          { participantId: "black-player", result: "LOSS" },
          { participantId: "white-player", result: "WIN" },
        ],
      },
    });
  });

  test("rejects stale resignations", () => {
    const result = validateResignation({
      match: buildMatch({ stateVersion: 8 }),
      participantId: "black-player",
      baseVersion: 7,
    });

    expect(result).toMatchObject({ ok: false, error: "stale_state", status: 409 });
  });
});
