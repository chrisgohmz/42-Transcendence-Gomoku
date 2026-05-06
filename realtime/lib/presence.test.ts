import { beforeEach, describe, expect, mock, test } from "bun:test";

import { removePresenceConnection, subscribeToPresence, type ConnectedUsers } from "./presence";

const join = mock();
const emit = mock();
let connectedUsers: ConnectedUsers;

beforeEach(() => {
  join.mockReset();
  emit.mockReset();
  connectedUsers = new Map();
});

describe("subscribeToPresence", () => {
  test("joins the authenticated user's room and publishes active usernames", () => {
    const socket = {
      data: { user: { username: "ada" } },
      id: "socket-1",
      join,
    };

    subscribeToPresence(socket, { emit }, connectedUsers);

    expect(join).toHaveBeenCalledWith("user:ada");
    expect(connectedUsers.get("socket-1")).toBe("ada");
    expect(emit).toHaveBeenCalledWith("presence:update", ["ada"]);
  });

  test("ignores sockets without a session-derived username", () => {
    const socket = {
      data: { user: {} },
      id: "socket-1",
      join,
    };

    subscribeToPresence(socket, { emit }, connectedUsers);

    expect(join).not.toHaveBeenCalled();
    expect(connectedUsers.size).toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("removePresenceConnection", () => {
  test("removes only the disconnected socket and republishes unique usernames", () => {
    connectedUsers.set("socket-1", "ada");
    connectedUsers.set("socket-2", "ada");
    connectedUsers.set("socket-3", "grace");

    removePresenceConnection({ id: "socket-1" }, { emit }, connectedUsers);

    expect(connectedUsers.has("socket-1")).toBe(false);
    expect(emit).toHaveBeenCalledWith("presence:update", ["ada", "grace"]);
  });
});
