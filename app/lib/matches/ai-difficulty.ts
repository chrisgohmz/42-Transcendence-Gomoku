import { aiDifficultyIds, type AiDifficultyId } from "../../../shared/ai-difficulty";

export { aiDifficultyIds, type AiDifficultyId };
export type AiDifficultyTone = "blue" | "brass" | "mint" | "purple";

export type AiDifficultyTraitLabelId = "openingStyle" | "midgame" | "endgame" | "favoritePattern";
export type AiDifficultyTraitValueId =
  | "centered"
  | "local"
  | "uneven"
  | "openTwos"
  | "openThrees"
  | "balanced"
  | "careful"
  | "pressure"
  | "forcing"
  | "clinical"
  | "forkThreats"
  | "flexible"
  | "tactical"
  | "precise"
  | "doubleThreats";
export type AiDifficultyStrengthId =
  | "simpleShapeBuilding"
  | "centerFriendlyOpenings"
  | "occasionalLooseDefense"
  | "blocksOpenFours"
  | "buildsBalancedLanes"
  | "canMissDoubleThreats"
  | "readsForcingLines"
  | "punishesOpenThrees"
  | "strongInMidgameFights"
  | "findsDoubleThreats"
  | "defendsForcingLadders"
  | "convertsWinningRaces";

export type AiDifficultyOption = {
  id: AiDifficultyId;
  strengthIds: AiDifficultyStrengthId[];
  tone: AiDifficultyTone;
  traits: Array<{ labelId: AiDifficultyTraitLabelId; valueId: AiDifficultyTraitValueId }>;
  engine: {
    candidateLimit: number;
    defenseWeight: number;
    mistakeChance: number;
    neighborRadius: number;
    responseDelayMs: readonly [number, number];
    scoreWindow: number;
    searchDepth: number;
    tacticalNoise: number;
    topMoveCount: number;
  };
};

export const defaultAiDifficultyId: AiDifficultyId = "expert";

export const aiDifficultyOptions = [
  {
    id: "beginner",
    strengthIds: ["simpleShapeBuilding", "centerFriendlyOpenings", "occasionalLooseDefense"],
    tone: "mint",
    traits: [
      { labelId: "openingStyle", valueId: "centered" },
      { labelId: "midgame", valueId: "local" },
      { labelId: "endgame", valueId: "uneven" },
      { labelId: "favoritePattern", valueId: "openTwos" },
    ],
    engine: {
      candidateLimit: 8,
      defenseWeight: 0.88,
      mistakeChance: 0.34,
      neighborRadius: 1,
      responseDelayMs: [380, 820],
      scoreWindow: 340,
      searchDepth: 1,
      tacticalNoise: 220,
      topMoveCount: 5,
    },
  },
  {
    id: "apprentice",
    strengthIds: ["blocksOpenFours", "buildsBalancedLanes", "canMissDoubleThreats"],
    tone: "blue",
    traits: [
      { labelId: "openingStyle", valueId: "flexible" },
      { labelId: "midgame", valueId: "balanced" },
      { labelId: "endgame", valueId: "careful" },
      { labelId: "favoritePattern", valueId: "openThrees" },
    ],
    engine: {
      candidateLimit: 12,
      defenseWeight: 1,
      mistakeChance: 0.22,
      neighborRadius: 2,
      responseDelayMs: [520, 980],
      scoreWindow: 260,
      searchDepth: 2,
      tacticalNoise: 140,
      topMoveCount: 4,
    },
  },
  {
    id: "expert",
    strengthIds: ["readsForcingLines", "punishesOpenThrees", "strongInMidgameFights"],
    tone: "purple",
    traits: [
      { labelId: "openingStyle", valueId: "flexible" },
      { labelId: "midgame", valueId: "tactical" },
      { labelId: "endgame", valueId: "precise" },
      { labelId: "favoritePattern", valueId: "doubleThreats" },
    ],
    engine: {
      candidateLimit: 16,
      defenseWeight: 1.08,
      mistakeChance: 0.11,
      neighborRadius: 2,
      responseDelayMs: [720, 1250],
      scoreWindow: 170,
      searchDepth: 2,
      tacticalNoise: 70,
      topMoveCount: 3,
    },
  },
  {
    id: "master",
    strengthIds: ["findsDoubleThreats", "defendsForcingLadders", "convertsWinningRaces"],
    tone: "brass",
    traits: [
      { labelId: "openingStyle", valueId: "pressure" },
      { labelId: "midgame", valueId: "forcing" },
      { labelId: "endgame", valueId: "clinical" },
      { labelId: "favoritePattern", valueId: "forkThreats" },
    ],
    engine: {
      candidateLimit: 20,
      defenseWeight: 1.16,
      mistakeChance: 0.05,
      neighborRadius: 2,
      responseDelayMs: [900, 1500],
      scoreWindow: 105,
      searchDepth: 3,
      tacticalNoise: 32,
      topMoveCount: 2,
    },
  },
] as const satisfies readonly AiDifficultyOption[];

export function isAiDifficultyId(value: unknown): value is AiDifficultyId {
  return (
    typeof value === "string" && aiDifficultyIds.some((difficultyId) => difficultyId === value)
  );
}

export function getAiDifficulty(value: unknown): AiDifficultyOption {
  const difficultyId = isAiDifficultyId(value) ? value : defaultAiDifficultyId;
  return (
    aiDifficultyOptions.find((difficulty) => difficulty.id === difficultyId) ??
    aiDifficultyOptions[2]
  );
}

export function getAiResponseDelayMs(difficulty: AiDifficultyOption): number {
  const [minDelay, maxDelay] = difficulty.engine.responseDelayMs;
  return Math.round(minDelay + Math.random() * (maxDelay - minDelay));
}
