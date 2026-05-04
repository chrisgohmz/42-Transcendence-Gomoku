import { describe, expect, test } from "bun:test";

import { buildBoard } from "./state-builder";

describe("buildBoard", () => {
  test("reconstructs the full board from ordered moves", () => {
    const board = buildBoard(
      3,
      [
        { id: "black-player", seat: "BLACK" },
        { id: "white-player", seat: "WHITE" },
      ],
      [
        { participantId: "black-player", moveNumber: 2, x: 1, y: 0 },
        { participantId: "white-player", moveNumber: 1, x: 0, y: 2 },
      ],
    );

    expect(board).toEqual([
      [{ occupied: false }, { occupied: true, seat: "BLACK", moveNumber: 2 }, { occupied: false }],
      [{ occupied: false }, { occupied: false }, { occupied: false }],
      [{ occupied: true, seat: "WHITE", moveNumber: 1 }, { occupied: false }, { occupied: false }],
    ]);
  });

  test("skips moves with unknown seats and out-of-bounds coordinates", () => {
    const board = buildBoard(
      2,
      [{ id: "spectator", seat: null }],
      [
        { participantId: "spectator", moveNumber: 1, x: 0, y: 0 },
        { participantId: "missing", moveNumber: 2, x: 5, y: 5 },
      ],
    );

    expect(board).toEqual([
      [{ occupied: false }, { occupied: false }],
      [{ occupied: false }, { occupied: false }],
    ]);
  });
});
