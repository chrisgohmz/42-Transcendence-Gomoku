export const challengeMatchMetadataKind = "human-challenge";

export type ChallengeMatchMetadata = {
  declineTokenHash: string;
  kind: typeof challengeMatchMetadataKind;
  targetUserId: string;
  targetUsername: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createChallengeMatchMetadata({
  declineTokenHash,
  targetUserId,
  targetUsername,
}: Omit<ChallengeMatchMetadata, "kind">): ChallengeMatchMetadata {
  return {
    declineTokenHash,
    kind: challengeMatchMetadataKind,
    targetUserId,
    targetUsername,
  };
}

export function getChallengeMatchMetadata(metadata: unknown): ChallengeMatchMetadata | null {
  if (!isRecord(metadata) || metadata["kind"] !== challengeMatchMetadataKind) {
    return null;
  }

  const declineTokenHash = metadata["declineTokenHash"];
  const targetUserId = metadata["targetUserId"];
  const targetUsername = metadata["targetUsername"];

  if (
    !isNonEmptyString(declineTokenHash) ||
    !isNonEmptyString(targetUserId) ||
    !isNonEmptyString(targetUsername)
  ) {
    return null;
  }

  return {
    declineTokenHash,
    kind: challengeMatchMetadataKind,
    targetUserId,
    targetUsername,
  };
}
