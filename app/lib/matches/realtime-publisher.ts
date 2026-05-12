import type { GameUpdatePayload } from "../../../shared/match-events";
import {
  internalRealtimeSecretHeader,
  readRealtimeInternalSecret,
} from "../../../shared/realtime-internal";

const defaultGameUpdateUrl = "http://realtime:3001/internal/game-update";

function readPositiveTimeoutMs(timeoutMs: number) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000;
}

export function resolveGameUpdateUrl(env: NodeJS.ProcessEnv = process.env) {
  return env["REALTIME_INTERNAL_URL"] ?? defaultGameUpdateUrl;
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
