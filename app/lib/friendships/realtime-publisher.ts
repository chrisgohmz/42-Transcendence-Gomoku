import {
  friendshipUpdatePath,
  internalRealtimeSecretHeader,
  readRealtimeInternalSecret,
  type FriendshipUpdatePayload,
} from "../../../shared/realtime-internal";

const defaultFriendshipUpdateUrl = "http://realtime:3001/internal/friendship-update";
const gameUpdatePathSuffix = "/internal/game-update";

function readPositiveTimeoutMs(timeoutMs: number) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000;
}

function replaceInternalPath(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    url.pathname = friendshipUpdatePath;
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    if (rawUrl.endsWith(gameUpdatePathSuffix)) {
      return `${rawUrl.slice(0, -gameUpdatePathSuffix.length)}${friendshipUpdatePath}`;
    }

    return defaultFriendshipUpdateUrl;
  }
}

export function resolveFriendshipUpdateUrl(env: NodeJS.ProcessEnv = process.env) {
  const friendshipUrl = env["REALTIME_FRIENDSHIP_INTERNAL_URL"];

  if (friendshipUrl) {
    return friendshipUrl;
  }

  const gameUpdateUrl = env["REALTIME_INTERNAL_URL"];

  if (!gameUpdateUrl) {
    return defaultFriendshipUpdateUrl;
  }

  return replaceInternalPath(gameUpdateUrl);
}

export async function publishFriendshipUpdate(
  usernames: string[],
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  const uniqueUsernames = Array.from(new Set(usernames));

  if (uniqueUsernames.length === 0) {
    return;
  }

  const internalSecret = readRealtimeInternalSecret();

  if (!internalSecret) {
    throw new Error("Missing REALTIME_INTERNAL_SECRET or BETTER_AUTH_SECRET");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readPositiveTimeoutMs(timeoutMs));
  const payload: FriendshipUpdatePayload = { usernames: uniqueUsernames };

  try {
    const response = await fetch(resolveFriendshipUpdateUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [internalRealtimeSecretHeader]: internalSecret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to publish friendship:refresh(${response.status})`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
