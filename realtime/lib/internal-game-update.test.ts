import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { GameUpdatePayload } from "../../shared/match-events";
import { internalRealtimeSecretHeader } from "../../shared/realtime-internal";
import { handleInternalGameUpdate } from "./internal-game-update";

const emit = mock((_event: string, _payload: GameUpdatePayload) => {});
const to = mock((_room: string) => ({ emit }));
const log = mock((_message: string) => {});

const payload: GameUpdatePayload = {
  board: [[{ occupied: false }]],
  boardSize: 1,
  endReason: null,
  lastMove: null,
  matchId: "match-1",
  moves: [],
  nextTurnSeat: null,
  participants: [],
  stateVersion: 0,
  status: "WAITING",
  visibility: "PUBLIC",
  winningSeat: null,
};

function jsonRequest(body: unknown, secret = "shared-secret") {
  return new Request("http://realtime/internal/game-update", {
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

describe("handleInternalGameUpdate", () => {
  test("rejects requests without the shared internal secret", async () => {
    const response = await handleInternalGameUpdate(jsonRequest(payload), { to }, null);
    const responsePayload = await response.json();

    expect(response.status).toBe(503);
    expect(responsePayload).toEqual({ error: "internal_secret_unconfigured" });
    expect(to).not.toHaveBeenCalled();
  });

  test("rejects requests with the wrong shared internal secret", async () => {
    const response = await handleInternalGameUpdate(
      jsonRequest(payload, "wrong-secret"),
      { to },
      "shared-secret",
    );
    const responsePayload = await response.json();

    expect(response.status).toBe(401);
    expect(responsePayload).toEqual({ error: "unauthorized" });
    expect(to).not.toHaveBeenCalled();
  });

  test("rejects malformed payloads without broadcasting", async () => {
    const response = await handleInternalGameUpdate(
      jsonRequest({ ...payload, moves: undefined }),
      { to },
      "shared-secret",
      { log },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_payload" });
    expect(to).not.toHaveBeenCalled();
  });

  test("broadcasts valid game updates to the match room", async () => {
    const response = await handleInternalGameUpdate(jsonRequest(payload), { to }, "shared-secret", {
      log,
    });
    const responsePayload = await response.json();

    expect(response.status).toBe(200);
    expect(responsePayload).toEqual({ ok: true, room: "match: match-1" });
    expect(to).toHaveBeenCalledWith("match: match-1");
    expect(emit).toHaveBeenCalledWith("game:update", payload);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
