import { beforeEach, describe, expect, mock, test } from "bun:test";

import { internalRealtimeSecretHeader } from "../../shared/realtime-internal";
import { handleInternalChallengeDeclined } from "./internal-challenge-declined";

const emit = mock((_event: string, _payload: unknown) => {});
const to = mock((_room: string) => ({ emit }));
const log = mock((_message: string) => {});

const payload = {
  matchId: "match-1",
  senderUsername: "white",
  username: "black",
};

function jsonRequest(body: unknown, secret = "shared-secret") {
  return new Request("http://realtime/internal/challenge-declined", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: secret,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  emit.mockReset();
  to.mockReset();
  log.mockReset();
  to.mockImplementation(() => ({ emit }));
});

describe("handleInternalChallengeDeclined", () => {
  test("rejects requests without the shared internal secret", async () => {
    const response = await handleInternalChallengeDeclined(jsonRequest(payload), { to }, null);
    const responsePayload = await response.json();

    expect(response.status).toBe(503);
    expect(responsePayload).toEqual({ error: "internal_secret_unconfigured" });
    expect(to).not.toHaveBeenCalled();
  });

  test("rejects malformed payloads without broadcasting", async () => {
    const response = await handleInternalChallengeDeclined(
      jsonRequest({ ...payload, username: "" }),
      { to },
      "shared-secret",
      { log },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_payload" });
    expect(to).not.toHaveBeenCalled();
  });

  test("broadcasts valid challenge decline events to the creator", async () => {
    const response = await handleInternalChallengeDeclined(
      jsonRequest(payload),
      { to },
      "shared-secret",
      { log },
    );
    const responsePayload = await response.json();

    expect(response.status).toBe(200);
    expect(responsePayload).toEqual({ ok: true, room: "user:black" });
    expect(to).toHaveBeenCalledWith("user:black");
    expect(emit).toHaveBeenCalledWith("challenge:declined", {
      matchId: "match-1",
      senderUsername: "white",
    });
    expect(log).toHaveBeenCalledTimes(1);
  });
});
