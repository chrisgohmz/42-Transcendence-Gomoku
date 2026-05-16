import {
  aiDifficultyOptions,
  defaultAiDifficultyId,
  getAiDifficulty,
  type AiDifficultyId,
} from "@/lib/matches/ai-difficulty";

export const soloAiDisplayNamePrefix = "Kata Reader";

type SoloParticipant = {
  displayName?: string;
  displayNameSnapshot?: string;
  role?: string;
  seat?: string | null;
};

function participantDisplayName(participant: SoloParticipant): string {
  return participant.displayNameSnapshot ?? participant.displayName ?? "";
}

export function getAiDisplayName(difficultyId: AiDifficultyId): string {
  return `${soloAiDisplayNamePrefix} · ${getAiDifficulty(difficultyId).name}`;
}

export function isSoloAiDisplayName(displayName: string): boolean {
  return displayName.startsWith(soloAiDisplayNamePrefix);
}

export function getAiDifficultyIdFromDisplayName(displayName: string): AiDifficultyId {
  const difficulty = aiDifficultyOptions.find((option) => displayName.endsWith(option.name));
  return difficulty?.id ?? defaultAiDifficultyId;
}

export function getSoloAiParticipant<TParticipant extends SoloParticipant>(
  participants: TParticipant[],
): TParticipant | null {
  return (
    participants.find((participant) => {
      const displayName = participantDisplayName(participant);

      return (
        participant.role === "PLAYER" &&
        (participant.seat === "BLACK" || participant.seat === "WHITE") &&
        isSoloAiDisplayName(displayName)
      );
    }) ?? null
  );
}

export function getSoloMatchDifficultyId(participants: SoloParticipant[]): AiDifficultyId {
  const aiParticipant = getSoloAiParticipant(participants);
  return aiParticipant
    ? getAiDifficultyIdFromDisplayName(participantDisplayName(aiParticipant))
    : defaultAiDifficultyId;
}
