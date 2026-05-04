import { describe, expect, test } from "bun:test";

import { MatchStatus, Role, Seat } from "../../../generated/prisma/enums";
import { validateMoveSubmission, type MoveMatchSnapshot } from "./move-rules";

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
