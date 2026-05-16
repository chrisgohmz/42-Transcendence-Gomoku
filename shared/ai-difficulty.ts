export const aiDifficultyIds = ["beginner", "apprentice", "expert", "master"] as const;

export type AiDifficultyId = (typeof aiDifficultyIds)[number];
