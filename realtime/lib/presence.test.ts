import { beforeEach, describe, expect, mock, test } from "bun:test";

import { removePresenceConnection, subscribeToPresence, type ConnectedUsers } from "./presence";

const join = mock();
const emit = mock();
const socketEmit = mock();
let connectedUsers: ConnectedUsers;

beforeEach(() => {
  join.mockReset();
  emit.mockReset();
  socketEmit.mockReset();
  connectedUsers = new Map();
});

describe("subscribeToPresence", () => {
  test("joins the authenticated user's room and publishes active usernames", () => {
    const socket = {
      data: { user: { username: "ada" } },
      emit: socketEmit,
      id: "socket-1",
      join,
    };

    subscribeToPresence(socket, { emit }, connectedUsers);

    expect(join).toHaveBeenCalledWith("user:ada");
    expect(connectedUsers.get("socket-1")).toBe("ada");
    expect(emit).toHaveBeenCalledWith("presence:update", ["ada"]);
    expect(socketEmit).not.toHaveBeenCalled();
  });

  test("sends a snapshot to reconnecting sockets when the public presence set is unchanged", () => {
    connectedUsers.set("socket-1", "ada");
    const socket = {
      data: { user: { username: "ada" } },
      emit: socketEmit,
      id: "socket-2",
      join,
    };

    subscribeToPresence(socket, { emit }, connectedUsers);

    expect(join).toHaveBeenCalledWith("user:ada");
    expect(connectedUsers.get("socket-2")).toBe("ada");
    expect(socketEmit).toHaveBeenCalledWith("presence:update", ["ada"]);
    expect(emit).not.toHaveBeenCalled();
  });

  test("ignores sockets without a session-derived username", () => {
    const socket = {
      data: { user: {} },
      emit: socketEmit,
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
  test("removes only the disconnected socket without broadcasting when the user is still online", () => {
    connectedUsers.set("socket-1", "ada");
    connectedUsers.set("socket-2", "ada");
    connectedUsers.set("socket-3", "grace");

    removePresenceConnection({ id: "socket-1" }, { emit }, connectedUsers);

    expect(connectedUsers.has("socket-1")).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  test("broadcasts when a user's final socket disconnects", () => {
    connectedUsers.set("socket-1", "ada");
    connectedUsers.set("socket-2", "grace");

    removePresenceConnection({ id: "socket-1" }, { emit }, connectedUsers);

    expect(connectedUsers.has("socket-1")).toBe(false);
    expect(emit).toHaveBeenCalledWith("presence:update", ["grace"]);
  });
});
