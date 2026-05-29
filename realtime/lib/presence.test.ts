import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  createRedisPresenceStore,
  removePresenceConnection,
  subscribeToPresence,
  type ConnectedUsers,
} from "./presence";

const join = mock();
const emit = mock();
const socketEmit = mock();
let connectedUsers: ConnectedUsers;

function createRedisPresenceClient() {
  const sets = new Map<string, Set<string>>();
  const values = new Map<string, string>();

  return {
    sets,
    values,
    del: mock(async (...keys: string[]) => {
      keys.forEach((key) => values.delete(key));
    }),
    mget: mock(async (...keys: string[]) => keys.map((key) => values.get(key) ?? null)),
    sadd: mock(async (key: string, ...members: string[]) => {
      const set = sets.get(key) ?? new Set<string>();
      members.forEach((member) => set.add(member));
      sets.set(key, set);
    }),
    setex: mock(async (key: string, _seconds: number, value: string) => {
      values.set(key, value);
    }),
    smembers: mock(async (key: string) => Array.from(sets.get(key) ?? [])),
    srem: mock(async (key: string, ...members: string[]) => {
      const set = sets.get(key);
      members.forEach((member) => set?.delete(member));
    }),
  };
}

beforeEach(() => {
  join.mockReset();
  emit.mockReset();
  socketEmit.mockReset();
  connectedUsers = new Map();
});

describe("subscribeToPresence", () => {
  test("joins the authenticated user's room and publishes active usernames", async () => {
    const socket = {
      data: { user: { username: "ada" } },
      emit: socketEmit,
      id: "socket-1",
      join,
    };

    await subscribeToPresence(socket, { emit }, connectedUsers);

    expect(join).toHaveBeenCalledWith("user:ada");
    expect(connectedUsers.get("socket-1")).toBe("ada");
    expect(emit).toHaveBeenCalledWith("presence:update", ["ada"]);
    expect(socketEmit).not.toHaveBeenCalled();
  });

  test("sends a snapshot to reconnecting sockets when the public presence set is unchanged", async () => {
    connectedUsers.set("socket-1", "ada");
    const socket = {
      data: { user: { username: "ada" } },
      emit: socketEmit,
      id: "socket-2",
      join,
    };

    await subscribeToPresence(socket, { emit }, connectedUsers);

    expect(join).toHaveBeenCalledWith("user:ada");
    expect(connectedUsers.get("socket-2")).toBe("ada");
    expect(socketEmit).toHaveBeenCalledWith("presence:update", ["ada"]);
    expect(emit).not.toHaveBeenCalled();
  });

  test("ignores sockets without a session-derived username", async () => {
    const socket = {
      data: { user: {} },
      emit: socketEmit,
      id: "socket-1",
      join,
    };

    await subscribeToPresence(socket, { emit }, connectedUsers);

    expect(join).not.toHaveBeenCalled();
    expect(connectedUsers.size).toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("removePresenceConnection", () => {
  test("removes only the disconnected socket without broadcasting when the user is still online", async () => {
    connectedUsers.set("socket-1", "ada");
    connectedUsers.set("socket-2", "ada");
    connectedUsers.set("socket-3", "grace");

    await removePresenceConnection({ id: "socket-1" }, { emit }, connectedUsers);

    expect(connectedUsers.has("socket-1")).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  test("broadcasts when a user's final socket disconnects", async () => {
    connectedUsers.set("socket-1", "ada");
    connectedUsers.set("socket-2", "grace");

    await removePresenceConnection({ id: "socket-1" }, { emit }, connectedUsers);

    expect(connectedUsers.has("socket-1")).toBe(false);
    expect(emit).toHaveBeenCalledWith("presence:update", ["grace"]);
  });
});

describe("createRedisPresenceStore", () => {
  test("tracks shared presence with stable usernames", async () => {
    const redis = createRedisPresenceClient();
    const store = createRedisPresenceStore(redis, {
      keyPrefix: "test",
      ttlSeconds: 45,
    });

    expect(await store.addConnection("socket-2", "grace")).toEqual(["grace"]);
    expect(await store.addConnection("socket-1", "ada")).toEqual(["ada", "grace"]);

    await store.refreshConnection?.("socket-2", "grace");

    expect(redis.setex).toHaveBeenCalledWith("test:connection:socket-2", 45, "grace");
    expect(redis.sadd).toHaveBeenCalledWith("test:connection-keys", "test:connection:socket-2");
  });

  test("prunes expired Redis connection keys", async () => {
    const redis = createRedisPresenceClient();
    const store = createRedisPresenceStore(redis, {
      keyPrefix: "test",
      ttlSeconds: 45,
    });

    await store.addConnection("socket-1", "ada");
    await store.addConnection("socket-2", "grace");
    redis.values.delete("test:connection:socket-1");

    expect(await store.getActiveUsernames()).toEqual(["grace"]);
    expect(redis.sets.get("test:connection-keys")?.has("test:connection:socket-1")).toBe(false);
  });
});
