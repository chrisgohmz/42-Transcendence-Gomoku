import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { chooseAiMove, type AiEngineMove, type AiEngineParticipant } from "./ai-engine";

const participants: AiEngineParticipant[] = [
  { id: "human", seat: "BLACK" },
  { id: "ai", seat: "WHITE" },
];

const originalRandom = Math.random;

function move(participantId: string, moveNumber: number, x: number, y: number): AiEngineMove {
  return { participantId, moveNumber, x, y };
}

beforeEach(() => {
  Math.random = () => 0;
});

afterEach(() => {
  Math.random = originalRandom;
});

describe("chooseAiMove", () => {
  test("takes an immediate winning move", () => {
    const choice = chooseAiMove({
      aiParticipantId: "ai",
      boardSize: 15,
      difficultyId: "expert",
      moves: [
        move("ai", 1, 3, 7),
        move("human", 2, 3, 8),
        move("ai", 3, 4, 7),
        move("human", 4, 4, 8),
        move("ai", 5, 5, 7),
        move("human", 6, 5, 8),
        move("ai", 7, 6, 7),
      ],
      participants,
    });

    expect([
      { x: 2, y: 7 },
      { x: 7, y: 7 },
    ]).toContainEqual(choice.position);
    expect(choice.reason).toContain("five in a row");
  });

  test("blocks a human immediate five-in-a-row threat", () => {
    const choice = chooseAiMove({
      aiParticipantId: "ai",
      boardSize: 15,
      difficultyId: "expert",
      moves: [
        move("human", 1, 3, 7),
        move("ai", 2, 3, 8),
        move("human", 3, 4, 7),
        move("ai", 4, 4, 8),
        move("human", 5, 5, 7),
        move("ai", 6, 5, 8),
        move("human", 7, 6, 7),
      ],
      participants,
    });

    expect([
      { x: 2, y: 7 },
      { x: 7, y: 7 },
    ]).toContainEqual(choice.position);
    expect(choice.reason).toContain("Blocks");
  });

  test("opens in the center on an empty board", () => {
    const choice = chooseAiMove({
      aiParticipantId: "ai",
      boardSize: 15,
      difficultyId: "beginner",
      moves: [],
      participants,
    });

    expect(choice.position).toEqual({ x: 7, y: 7 });
    expect(choice.searchedPlies).toBe(1);
  });
});
