import type { GameUpdatePayload } from "../../../shared/match-events";
import { isGameUpdatePayload } from "../../../shared/match-events-validation";
import {
  challengeDeclinedPath,
  challengeReceivedPath,
  internalRealtimeSecretHeader,
  readRealtimeInternalSecret,
} from "../../../shared/realtime-internal";
import {
  realtimeOutboxTopics,
  type RealtimeOutboxPublishEvent,
  type RealtimeOutboxTopic,
} from "../realtime-outbox-contract";
import type {
  DrainRealtimeOutboxOptions,
  enqueueRealtimeOutboxEvent,
} from "../realtime-outbox-core";

const defaultGameUpdateUrl = "http://realtime:3001/internal/game-update";
const defaultQueueMatchedUrl = "http://realtime:3001/internal/queue-matched";
const defaultChallengeDeclinedUrl = `http://realtime:3001${challengeDeclinedPath}`;
const defaultChallengeReceivedUrl = `http://realtime:3001${challengeReceivedPath}`;

type RealtimePublishOptions = {
  enqueueOutboxEvent?: typeof enqueueRealtimeOutboxEvent;
  persistOnFailure?: boolean;
};

type QueueMatchedPayload = {
  username: string;
  session: unknown;
};

type ChallengeDeclinedOutboxPayload = {
  matchId: string;
  senderUsername: string;
  username: string;
};

function readPositiveTimeoutMs(timeoutMs: number) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function shouldPersistOnFailure(options: RealtimePublishOptions | undefined) {
  return options?.persistOnFailure ?? process.env["NODE_ENV"] !== "test";
}

async function persistRealtimeFailure(
  topic: RealtimeOutboxTopic,
  payload: unknown,
  error: unknown,
  options?: RealtimePublishOptions,
) {
  if (!shouldPersistOnFailure(options)) {
    return;
  }

  try {
    const enqueueOutboxEvent =
      options?.enqueueOutboxEvent ??
      (await import("../realtime-outbox")).enqueueRealtimeOutboxEvent;

    await enqueueOutboxEvent({
      error,
      payload,
      topic,
    });
  } catch (outboxError) {
    console.error("[realtime-outbox] failed to enqueue event:", getErrorMessage(outboxError));
  }
}

async function postRealtimeJson(url: string, payload: unknown, timeoutMs: number) {
  const internalSecret = readRealtimeInternalSecret();

  if (!internalSecret) {
    throw new Error("Missing REALTIME_INTERNAL_SECRET");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readPositiveTimeoutMs(timeoutMs));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [internalRealtimeSecretHeader]: internalSecret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readQueueMatchedPayload(value: unknown): QueueMatchedPayload {
  if (!isRecord(value) || typeof value["username"] !== "string") {
    throw new Error("Invalid queue:matched outbox payload");
  }

  return {
    session: value["session"],
    username: value["username"],
  };
}

function readChallengeDeclinedPayload(value: unknown): ChallengeDeclinedOutboxPayload {
  if (
    !isRecord(value) ||
    typeof value["matchId"] !== "string" ||
    typeof value["senderUsername"] !== "string" ||
    typeof value["username"] !== "string"
  ) {
    throw new Error("Invalid challenge:declined outbox payload");
  }

  return {
    matchId: value["matchId"],
    senderUsername: value["senderUsername"],
    username: value["username"],
  };
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
  options?: RealtimePublishOptions,
) {
  try {
    const response = await postRealtimeJson(resolveGameUpdateUrl(), payload, timeoutMs);

    if (!response.ok) {
      throw new Error(`Failed to publish game:update(${response.status})`);
    }
  } catch (error) {
    await persistRealtimeFailure(realtimeOutboxTopics.gameUpdate, payload, error, options);
    throw error;
  }
}

export async function publishQueueMatched(
  username: string,
  session: unknown,
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
  options?: RealtimePublishOptions,
) {
  const payload = { username, session };

  try {
    const baseUrl = resolveGameUpdateUrl().replace("/internal/game-update", "");
    const finalUrl = baseUrl.includes("localhost")
      ? `${baseUrl}/internal/queue-matched`
      : resolveQueueMatchedUrl();

    const response = await postRealtimeJson(finalUrl, payload, timeoutMs);

    if (!response.ok) {
      throw new Error(`Failed to publish queue:matched (${response.status})`);
    }
  } catch (error) {
    await persistRealtimeFailure(realtimeOutboxTopics.queueMatched, payload, error, options);
    throw error;
  }
}

export async function publishChallengeDeclined(
  username: string,
  payload: { matchId: string; senderUsername: string },
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
  options?: RealtimePublishOptions,
) {
  const body = {
    ...payload,
    username,
  };

  try {
    const response = await postRealtimeJson(resolveChallengeDeclinedUrl(), body, timeoutMs);

    if (!response.ok) {
      throw new Error(`Failed to publish challenge:declined (${response.status})`);
    }
  } catch (error) {
    await persistRealtimeFailure(realtimeOutboxTopics.challengeDeclined, body, error, options);
    throw error;
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
  const response = await postRealtimeJson(
    resolveChallengeReceivedUrl(),
    {
      ...payload,
      username,
    },
    timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Failed to publish challenge:receive (${response.status})`);
  }
}

export async function publishRealtimeOutboxEvent(
  event: RealtimeOutboxPublishEvent,
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  switch (event.topic) {
    case realtimeOutboxTopics.gameUpdate:
      if (!isGameUpdatePayload(event.payload)) {
        throw new Error("Invalid game:update outbox payload");
      }
      await publishGameUpdate(event.payload, timeoutMs, { persistOnFailure: false });
      return;
    case realtimeOutboxTopics.queueMatched: {
      const payload = readQueueMatchedPayload(event.payload);
      await publishQueueMatched(payload.username, payload.session, timeoutMs, {
        persistOnFailure: false,
      });
      return;
    }
    case realtimeOutboxTopics.challengeDeclined: {
      const payload = readChallengeDeclinedPayload(event.payload);
      await publishChallengeDeclined(
        payload.username,
        {
          matchId: payload.matchId,
          senderUsername: payload.senderUsername,
        },
        timeoutMs,
        { persistOnFailure: false },
      );
      return;
    }
  }
}

export async function drainMatchRealtimeOutbox(
  options: Omit<DrainRealtimeOutboxOptions, "publish"> = {},
) {
  const { drainRealtimeOutbox } = await import("../realtime-outbox-core");

  return drainRealtimeOutbox({
    ...options,
    publish: publishRealtimeOutboxEvent,
  });
}
