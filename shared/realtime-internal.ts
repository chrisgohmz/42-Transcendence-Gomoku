export const challengeReceivedPath = "/internal/challenge-received";
export const challengeDeclinedPath = "/internal/challenge-declined";
export const chatMessagePath = "/internal/chat-message";
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

export type ChatMessagePayload = {
  conversationId: string;
  message: {
    id: string;
    body: string;
    createdAt: string;
    sender: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isOptionalBoundedString(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function isChatMessageSender(
  value: unknown,
): value is NonNullable<ChatMessagePayload["message"]["sender"]> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBoundedString(value["id"], 128) &&
    isBoundedString(value["username"], 128) &&
    isBoundedString(value["displayName"], 256) &&
    isOptionalBoundedString(value["avatarUrl"], 2048)
  );
}

export function isFriendshipUpdatePayload(payload: unknown): payload is FriendshipUpdatePayload {
  if (!isRecord(payload)) {
    return false;
  }

  const usernames = payload["usernames"];

  return Array.isArray(usernames) && usernames.every(isNonEmptyString);
}

export function isChatMessagePayload(payload: unknown): payload is ChatMessagePayload {
  if (!isRecord(payload) || !isBoundedString(payload["conversationId"], 128)) {
    return false;
  }

  const message = payload["message"];
  if (!isRecord(message)) {
    return false;
  }

  const sender = message["sender"];

  return (
    isBoundedString(message["id"], 128) &&
    isBoundedString(message["body"], 2000) &&
    isBoundedString(message["createdAt"], 128) &&
    (sender === null || isChatMessageSender(sender))
  );
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
