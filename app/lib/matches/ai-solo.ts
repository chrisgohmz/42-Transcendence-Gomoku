import {
  defaultAiDifficultyId,
  isAiDifficultyId,
  type AiDifficultyId,
} from "@/lib/matches/ai-difficulty";

export const soloAiDisplayName = "Kata Reader";
export const soloMatchMode = "ai";

type SoloParticipant = {
  role?: string;
  seat?: string | null;
  userId?: string | null;
};

export type SoloMatchMetadata = {
  aiDifficulty: AiDifficultyId;
  mode: typeof soloMatchMode;
};

export function createSoloMatchMetadata(difficultyId: AiDifficultyId): SoloMatchMetadata {
  return {
    aiDifficulty: difficultyId,
    mode: soloMatchMode,
  };
}

export function getAiDisplayName(): string {
  return soloAiDisplayName;
}

export function getSoloAiParticipant<TParticipant extends SoloParticipant>(
  participants: TParticipant[],
): TParticipant | null {
  return (
    participants.find(
      (participant) =>
        participant.role === "PLAYER" &&
        participant.userId === null &&
        (participant.seat === "BLACK" || participant.seat === "WHITE"),
    ) ?? null
  );
}

export function getSoloMatchMetadata(metadata: unknown): SoloMatchMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  if (record["mode"] !== soloMatchMode || !isAiDifficultyId(record["aiDifficulty"])) {
    return null;
  }

  return createSoloMatchMetadata(record["aiDifficulty"]);
}

export function getSoloMatchDifficultyId(metadata: unknown): AiDifficultyId {
  return getSoloMatchMetadata(metadata)?.aiDifficulty ?? defaultAiDifficultyId;
}
