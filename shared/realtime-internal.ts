export const friendshipUpdatePath = "/internal/friendship-update";
export const internalRealtimeSecretHeader = "x-realtime-internal-secret";

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

export function readRealtimeInternalSecret(env: NodeJS.ProcessEnv = process.env) {
  return env["REALTIME_INTERNAL_SECRET"]?.trim() || env["BETTER_AUTH_SECRET"]?.trim() || null;
}
