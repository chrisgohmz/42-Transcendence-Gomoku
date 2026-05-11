import type { GameUpdatePayload } from "../../../shared/match-events";

export async function publishGameUpdate(
  payload: GameUpdatePayload,
  timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000),
) {
  const realtimeInternalUrl =
    process.env["REALTIME_INTERNAL_URL"] ?? "http://realtime:3001/internal/game-update";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(realtimeInternalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
