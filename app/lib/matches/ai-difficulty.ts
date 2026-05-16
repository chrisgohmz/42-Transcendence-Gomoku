export const aiDifficultyIds = ["beginner", "apprentice", "expert", "master"] as const;

export type AiDifficultyId = (typeof aiDifficultyIds)[number];
export type AiDifficultyTone = "blue" | "brass" | "mint" | "purple";

export type AiDifficultyOption = {
  id: AiDifficultyId;
  name: string;
  range: string;
  summary: string;
  description: string;
  tone: AiDifficultyTone;
  strengths: string[];
  stats: Array<{ label: string; value: string; bars: number }>;
  traits: Array<{ label: string; value: string }>;
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
    name: "Beginner",
    range: "Level 1 - 800",
    summary: "Calm openings",
    description: "Learns local shapes, misses some forcing lines, and favors readable moves.",
    tone: "mint",
    strengths: ["Simple shape building", "Center-friendly openings", "Occasional loose defense"],
    stats: [
      { label: "Accuracy", value: "54%", bars: 4 },
      { label: "Aggression", value: "38%", bars: 3 },
      { label: "Defense", value: "46%", bars: 4 },
    ],
    traits: [
      { label: "Opening Style", value: "Centered" },
      { label: "Midgame", value: "Local" },
      { label: "Endgame", value: "Uneven" },
      { label: "Favorite Pattern", value: "Open twos" },
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
    name: "Apprentice",
    range: "Level 2 - 1100",
    summary: "Balanced reading",
    description: "Looks ahead one reply, blocks obvious threats, and still leaves chances.",
    tone: "blue",
    strengths: ["Blocks open fours", "Builds balanced lanes", "Can miss double threats"],
    stats: [
      { label: "Accuracy", value: "68%", bars: 5 },
      { label: "Aggression", value: "54%", bars: 4 },
      { label: "Defense", value: "63%", bars: 5 },
    ],
    traits: [
      { label: "Opening Style", value: "Flexible" },
      { label: "Midgame", value: "Balanced" },
      { label: "Endgame", value: "Careful" },
      { label: "Favorite Pattern", value: "Open threes" },
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
    name: "Expert",
    range: "Level 5 - 1700",
    summary: "Sharp tactics",
    description: "Reads forcing lines, values defense, and randomizes among close top moves.",
    tone: "purple",
    strengths: ["Reads forcing lines", "Punishes open threes", "Strong in midgame fights"],
    stats: [
      { label: "Accuracy", value: "82%", bars: 7 },
      { label: "Aggression", value: "72%", bars: 6 },
      { label: "Defense", value: "80%", bars: 7 },
    ],
    traits: [
      { label: "Opening Style", value: "Flexible" },
      { label: "Midgame", value: "Tactical" },
      { label: "Endgame", value: "Precise" },
      { label: "Favorite Pattern", value: "Double threats" },
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
    name: "Master",
    range: "Level 8 - 2300",
    summary: "Tournament strength",
    description: "Searches deeper, prunes harder, and usually answers forcing threats.",
    tone: "brass",
    strengths: ["Finds double threats", "Defends forcing ladders", "Converts winning races"],
    stats: [
      { label: "Accuracy", value: "91%", bars: 8 },
      { label: "Aggression", value: "84%", bars: 7 },
      { label: "Defense", value: "90%", bars: 8 },
    ],
    traits: [
      { label: "Opening Style", value: "Pressure" },
      { label: "Midgame", value: "Forcing" },
      { label: "Endgame", value: "Clinical" },
      { label: "Favorite Pattern", value: "Fork threats" },
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
