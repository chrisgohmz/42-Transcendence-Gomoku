import type { GameUpdatePayload } from "../../../shared/match-events";
import {
  challengeDeclinedPath,
  challengeReceivedPath,
  internalRealtimeSecretHeader,
  readRealtimeInternalSecret,
} from "../../../shared/realtime-internal";

const defaultGameUpdateUrl = "http://realtime:3001/internal/game-update";
const defaultQueueMatchedUrl = "http://realtime:3001/internal/queue-matched";
const defaultChallengeDeclinedUrl = `http://realtime:3001${challengeDeclinedPath}`;
const defaultChallengeReceivedUrl = `http://realtime:3001${challengeReceivedPath}`;

function readPositiveTimeoutMs(timeoutMs: number) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000;
}

export function resolveGameUpdateUrl(env: NodeJS.ProcessEnv = process.env) {
  return env["REALTIME_INTERNAL_URL"] ?? defaultGameUpdateUrl;
}

export function resolveQueueMatchedUrl(env: NodeJS.ProcessEnv = process.env) {
  return env["REALTIME_QUEUE_MATCHED_URL"] ?? defaultQueueMatchedUrl;
}

export function resolveChallengeDeclinedUrl(env: NodeJS.ProcessEnv = process.env) {
  if (env["REALTIME_CHALLENGE_DECLINED_URL"]) {
    return env["REALTIME_CHALLENGE_DECLINED_URL"];
  }

  const baseUrl = resolveGameUpdateUrl(env).replace("/internal/game-update", "");
  return baseUrl ? `${baseUrl}${challengeDeclinedPath}` : defaultChallengeDeclinedUrl;
}

export function resolveChallengeReceivedUrl(env: NodeJS.ProcessEnv = process.env) {
  if (env["REALTIME_CHALLENGE_RECEIVED_URL"]) {
    return env["REALTIME_CHALLENGE_RECEIVED_URL"];
  }

  const baseUrl = resolveGameUpdateUrl(env).replace("/internal/game-update", "");
  return baseUrl ? `${baseUrl}${challengeReceivedPath}` : defaultChallengeReceivedUrl;
}

export async function publishGameUpdate(
  payload: GameUpdatePayload,
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  const internalSecret = readRealtimeInternalSecret();

  if (!internalSecret) {
    throw new Error("Missing REALTIME_INTERNAL_SECRET or BETTER_AUTH_SECRET");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readPositiveTimeoutMs(timeoutMs));

  try {
    const response = await fetch(resolveGameUpdateUrl(), {
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
      throw new Error(`Failed to publish game:update(${response.status})`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function publishQueueMatched(
  username: string,
  session: any,
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  const internalSecret = readRealtimeInternalSecret();

  if (!internalSecret) {
    throw new Error("Missing REALTIME_INTERNAL_SECRET");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readPositiveTimeoutMs(timeoutMs));

  try {
    const baseUrl = resolveGameUpdateUrl().replace("/internal/game-update", "");
    const finalUrl = baseUrl.includes("localhost")
      ? `${baseUrl}/internal/queue-matched`
      : resolveQueueMatchedUrl();

    const response = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [internalRealtimeSecretHeader]: internalSecret,
      },
      body: JSON.stringify({ username, session }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to publish queue:matched (${response.status})`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function publishChallengeDeclined(
  username: string,
  payload: { matchId: string; senderUsername: string },
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  const internalSecret = readRealtimeInternalSecret();

  if (!internalSecret) {
    throw new Error("Missing REALTIME_INTERNAL_SECRET");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readPositiveTimeoutMs(timeoutMs));

  try {
    const response = await fetch(resolveChallengeDeclinedUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [internalRealtimeSecretHeader]: internalSecret,
      },
      body: JSON.stringify({
        ...payload,
        username,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to publish challenge:declined (${response.status})`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function publishChallengeReceived(
  username: string,
  payload: {
    declineToken: string;
    matchId: string;
    password: string;
    senderUsername: string;
  },
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  const internalSecret = readRealtimeInternalSecret();

  if (!internalSecret) {
    throw new Error("Missing REALTIME_INTERNAL_SECRET");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readPositiveTimeoutMs(timeoutMs));

  try {
    const response = await fetch(resolveChallengeReceivedUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [internalRealtimeSecretHeader]: internalSecret,
      },
      body: JSON.stringify({
        ...payload,
        username,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to publish challenge:receive (${response.status})`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
