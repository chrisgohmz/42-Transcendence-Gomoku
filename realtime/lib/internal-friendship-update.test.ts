import { beforeEach, describe, expect, mock, test } from "bun:test";

import { internalRealtimeSecretHeader } from "../../shared/realtime-internal";
import { handleInternalFriendshipUpdate } from "./internal-friendship-update";

const emit = mock((_event: string) => {});
const to = mock((_room: string) => ({ emit }));
const log = mock((_message: string) => {});

function jsonRequest(body: unknown, secret = "shared-secret") {
  return new Request("http://realtime/internal/friendship-update", {
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

describe("handleInternalFriendshipUpdate", () => {
  test("rejects requests without the shared internal secret", async () => {
    const response = await handleInternalFriendshipUpdate(
      jsonRequest({ usernames: ["alice"] }),
      { to },
      null,
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: "internal_secret_unconfigured" });
    expect(to).not.toHaveBeenCalled();
  });

  test("rejects requests with the wrong shared internal secret", async () => {
    const response = await handleInternalFriendshipUpdate(
      jsonRequest({ usernames: ["alice"] }, "wrong-secret"),
      { to },
      "shared-secret",
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "unauthorized" });
    expect(to).not.toHaveBeenCalled();
  });

  test("rejects malformed payloads without throwing", async () => {
    const invalidPayloads = [null, { usernames: "alice" }, { usernames: ["alice", 42] }];

    for (const payload of invalidPayloads) {
      const response = await handleInternalFriendshipUpdate(
        jsonRequest(payload),
        { to },
        "shared-secret",
        { log },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_payload" });
    }

    expect(to).not.toHaveBeenCalled();
  });

  test("emits friendship refreshes to the requested user rooms", async () => {
    const response = await handleInternalFriendshipUpdate(
      jsonRequest({ usernames: ["alice", "bob"] }),
      { to },
      "shared-secret",
      { log },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(to.mock.calls.map((call) => call[0])).toEqual(["user:alice", "user:bob"]);
    expect(emit.mock.calls.map((call) => call[0])).toEqual([
      "friendship:refresh",
      "friendship:refresh",
    ]);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
