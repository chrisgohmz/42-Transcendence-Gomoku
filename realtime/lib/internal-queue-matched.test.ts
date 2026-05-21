import { describe, expect, mock, test } from "bun:test";

import { internalRealtimeSecretHeader } from "../../shared/realtime-internal";
import { handleInternalQueueMatched } from "./internal-queue-matched";

describe("handleInternalQueueMatched", () => {
  test("rejects requests without a configured or matching internal secret", async () => {
    const unconfigured = await handleInternalQueueMatched(request({}, "wrong-secret"), io(), "");
    const unauthorized = await handleInternalQueueMatched(
      request({}, "wrong-secret"),
      io(),
      "secret",
    );

    expect(unconfigured.status).toBe(503);
    expect(await unconfigured.json()).toEqual({ error: "internal_secret_unconfigured" });
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: "unauthorized" });
  });

  test("rejects malformed JSON payloads", async () => {
    const response = await handleInternalQueueMatched(
      new Request("http://realtime/internal/queue-matched", {
        body: "{",
        headers: {
          [internalRealtimeSecretHeader]: "secret",
        },
        method: "POST",
      }),
      io(),
      "secret",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_payload" });
  });

  test("broadcasts matched sessions to the target user room", async () => {
    const emit = mock();
    const to = mock((_room: string) => ({
      emit,
    }));
    const server = { to };

    const response = await handleInternalQueueMatched(
      request(
        {
          username: "black",
          session: {
            matchId: "match-1",
            participantId: "black-player",
          },
        },
        "secret",
      ),
      server,
      "secret",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(to).toHaveBeenCalledWith("user:black");
    expect(emit).toHaveBeenCalledWith("queue:matched", {
      matchId: "match-1",
      participantId: "black-player",
    });
    expect(emit).toHaveBeenCalledWith("queue:status", {
      kind: "matched",
      session: {
        matchId: "match-1",
        participantId: "black-player",
      },
    });
  });
});

function request(payload: unknown, secret: string) {
  return new Request("http://realtime/internal/queue-matched", {
    body: JSON.stringify(payload),
    headers: {
      [internalRealtimeSecretHeader]: secret,
    },
    method: "POST",
  });
}

function io() {
  return {
    to: mock(() => ({
      emit: mock(),
    })),
  };
}
