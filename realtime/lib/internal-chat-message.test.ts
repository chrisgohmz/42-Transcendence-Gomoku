import { beforeEach, describe, expect, mock, test } from "bun:test";

import { chatMessagePath, internalRealtimeSecretHeader } from "../../shared/realtime-internal";
import { handleInternalChatMessage } from "./internal-chat-message";

const emit = mock((_event: string, _payload: unknown) => {});
const to = mock((_room: string) => ({ emit }));
const log = mock((_message: string) => {});

const payload = {
  conversationId: "conv-1",
  message: {
    id: "msg-1",
    body: "hello",
    createdAt: "2026-05-23T08:00:00.000Z",
    sender: {
      id: "user-alice",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    },
  },
};

beforeEach(() => {
  emit.mockReset();
  to.mockReset();
  log.mockReset();
  to.mockImplementation(() => ({ emit }));
});

describe("handleInternalChatMessage", () => {
  test("rejects requests without the shared internal secret", async () => {
    const response = await handleInternalChatMessage(jsonRequest(payload), { to }, null);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "internal_secret_unconfigured" });
    expect(to).not.toHaveBeenCalled();
  });

  test("rejects requests with the wrong shared internal secret", async () => {
    const response = await handleInternalChatMessage(
      jsonRequest(payload, "wrong"),
      { to },
      "secret",
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(to).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON and invalid chat payloads without broadcasting", async () => {
    const malformedJson = await handleInternalChatMessage(
      new Request(`http://realtime${chatMessagePath}`, {
        body: "{",
        headers: {
          [internalRealtimeSecretHeader]: "secret",
        },
        method: "POST",
      }),
      { to },
      "secret",
      { log },
    );
    const invalidPayload = await handleInternalChatMessage(
      jsonRequest({ ...payload, message: { ...payload.message, id: "" } }),
      { to },
      "secret",
      { log },
    );

    expect(malformedJson.status).toBe(400);
    expect(await malformedJson.json()).toEqual({ error: "invalid_payload" });
    expect(invalidPayload.status).toBe(400);
    expect(await invalidPayload.json()).toEqual({ error: "invalid_payload" });
    expect(to).not.toHaveBeenCalled();
  });

  test("broadcasts valid chat messages to the conversation room", async () => {
    const response = await handleInternalChatMessage(jsonRequest(payload), { to }, "secret", {
      log,
    });
    const responsePayload = await response.json();

    expect(response.status).toBe(200);
    expect(responsePayload).toEqual({ ok: true, room: "conv:conv-1" });
    expect(to).toHaveBeenCalledWith("conv:conv-1");
    expect(emit).toHaveBeenCalledWith("chat:message", payload.message);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

function jsonRequest(body: unknown, secret = "secret") {
  return new Request(`http://realtime${chatMessagePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [internalRealtimeSecretHeader]: secret,
    },
    body: JSON.stringify(body),
  });
}
