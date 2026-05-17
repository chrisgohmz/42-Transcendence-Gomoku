export const challengeReceivedPath = "/internal/challenge-received";
export const challengeDeclinedPath = "/internal/challenge-declined";
export const friendshipUpdatePath = "/internal/friendship-update";
export const internalRealtimeSecretHeader = "x-realtime-internal-secret";

export type ChallengeReceivedPayload = {
  declineToken: string;
  matchId: string;
  password: string;
  senderUsername: string;
  username: string;
};

export type ChallengeDeclinedPayload = {
  matchId: string;
  senderUsername: string;
  username: string;
};

export type FriendshipUpdatePayload = {
  usernames: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

export function isFriendshipUpdatePayload(payload: unknown): payload is FriendshipUpdatePayload {
  if (!isRecord(payload)) {
    return false;
  }

  const usernames = payload["usernames"];

  return Array.isArray(usernames) && usernames.every(isNonEmptyString);
}

export function isChallengeDeclinedPayload(payload: unknown): payload is ChallengeDeclinedPayload {
  if (!isRecord(payload)) {
    return false;
  }

  return (
    isNonEmptyString(payload["matchId"]) &&
    isNonEmptyString(payload["senderUsername"]) &&
    isNonEmptyString(payload["username"])
  );
}

export function isChallengeReceivedPayload(payload: unknown): payload is ChallengeReceivedPayload {
  if (!isRecord(payload)) {
    return false;
  }

  return (
    isNonEmptyString(payload["declineToken"]) &&
    isNonEmptyString(payload["matchId"]) &&
    isNonEmptyString(payload["password"]) &&
    isNonEmptyString(payload["senderUsername"]) &&
    isNonEmptyString(payload["username"])
  );
}

export function readRealtimeInternalSecret(env: NodeJS.ProcessEnv = process.env) {
  return env["REALTIME_INTERNAL_SECRET"]?.trim() || env["BETTER_AUTH_SECRET"]?.trim() || null;
}
