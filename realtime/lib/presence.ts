export type ConnectedUsers = Map<string, string>;

export type PresenceStore = {
  addConnection(socketId: string, username: string): Promise<string[]>;
  getActiveUsernames(): Promise<string[]>;
  refreshConnection?(socketId: string, username: string): Promise<void>;
  removeConnection(socketId: string): Promise<string[]>;
};

type PresenceBackend = ConnectedUsers | PresenceStore;

type PresenceBroadcaster = {
  emit(event: "presence:update", users: string[]): unknown;
};

type PresenceSocket = {
  data: {
    user?: {
      username?: string | null;
    };
  };
  id: string;
  emit(event: "presence:update", users: string[]): unknown;
  join(room: string): unknown;
};

type RedisPresenceClient = {
  del(...keys: string[]): Promise<unknown>;
  mget(...keys: string[]): Promise<Array<string | null>>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<unknown>;
};

type RedisPresenceStoreOptions = {
  keyPrefix?: string;
  ttlSeconds: number;
};

function uniqueSortedUsernames(usernames: Iterable<string>) {
  return Array.from(new Set(usernames)).sort((left, right) => left.localeCompare(right));
}

export function getActiveUsernames(connectedUsers: ConnectedUsers) {
  return uniqueSortedUsernames(connectedUsers.values());
}

function hasSameUsernames(left: string[], right: string[]) {
  if (left.length !== right.length) return false;

  const rightUsernames = new Set(right);
  return left.every((username) => rightUsernames.has(username));
}

function isPresenceStore(backend: PresenceBackend): backend is PresenceStore {
  return "getActiveUsernames" in backend;
}

function normalizeKeyPrefix(prefix: string) {
  return prefix.endsWith(":") ? prefix : `${prefix}:`;
}

async function getPresenceUsernames(backend: PresenceBackend) {
  return isPresenceStore(backend) ? backend.getActiveUsernames() : getActiveUsernames(backend);
}

async function addPresenceConnection(backend: PresenceBackend, socketId: string, username: string) {
  if (isPresenceStore(backend)) {
    return backend.addConnection(socketId, username);
  }

  backend.set(socketId, username);
  return getActiveUsernames(backend);
}

async function removePresenceConnectionFromBackend(backend: PresenceBackend, socketId: string) {
  if (isPresenceStore(backend)) {
    return backend.removeConnection(socketId);
  }

  backend.delete(socketId);
  return getActiveUsernames(backend);
}

export function createMemoryPresenceStore(connectedUsers: ConnectedUsers): PresenceStore {
  return {
    async addConnection(socketId, username) {
      connectedUsers.set(socketId, username);
      return getActiveUsernames(connectedUsers);
    },
    async getActiveUsernames() {
      return getActiveUsernames(connectedUsers);
    },
    async refreshConnection(socketId, username) {
      if (connectedUsers.has(socketId)) {
        connectedUsers.set(socketId, username);
      }
    },
    async removeConnection(socketId) {
      connectedUsers.delete(socketId);
      return getActiveUsernames(connectedUsers);
    },
  };
}

export function createRedisPresenceStore(
  redis: RedisPresenceClient,
  { keyPrefix = "transcendence:presence:", ttlSeconds }: RedisPresenceStoreOptions,
): PresenceStore {
  const normalizedKeyPrefix = normalizeKeyPrefix(keyPrefix);
  const connectionSetKey = `${normalizedKeyPrefix}connection-keys`;
  const connectionKey = (socketId: string) => `${normalizedKeyPrefix}connection:${socketId}`;

  async function getRedisActiveUsernames() {
    const keys = await redis.smembers(connectionSetKey);

    if (keys.length === 0) {
      return [];
    }

    const values = await redis.mget(...keys);
    const expiredKeys: string[] = [];
    const usernames: string[] = [];

    values.forEach((username, index) => {
      const key = keys[index];

      if (!key) {
        return;
      }

      if (username) {
        usernames.push(username);
        return;
      }

      expiredKeys.push(key);
    });

    if (expiredKeys.length > 0) {
      await redis.srem(connectionSetKey, ...expiredKeys);
    }

    return uniqueSortedUsernames(usernames);
  }

  async function setConnection(socketId: string, username: string) {
    const key = connectionKey(socketId);
    await Promise.all([redis.setex(key, ttlSeconds, username), redis.sadd(connectionSetKey, key)]);
  }

  return {
    async addConnection(socketId, username) {
      await setConnection(socketId, username);
      return getRedisActiveUsernames();
    },
    getActiveUsernames: getRedisActiveUsernames,
    async refreshConnection(socketId, username) {
      await setConnection(socketId, username);
    },
    async removeConnection(socketId) {
      const key = connectionKey(socketId);
      await Promise.all([redis.del(key), redis.srem(connectionSetKey, key)]);
      return getRedisActiveUsernames();
    },
  };
}

export async function subscribeToPresence(
  socket: PresenceSocket,
  broadcaster: PresenceBroadcaster,
  presence: PresenceBackend,
) {
  const username = socket.data.user?.username;
  if (!username) return;

  const previousUsernames = await getPresenceUsernames(presence);

  await socket.join(`user:${username}`);

  const activeUsernames = await addPresenceConnection(presence, socket.id, username);
  if (hasSameUsernames(previousUsernames, activeUsernames)) {
    socket.emit("presence:update", activeUsernames);
    return;
  }

  broadcaster.emit("presence:update", activeUsernames);
}

export async function refreshPresenceConnection(
  socket: Pick<PresenceSocket, "data" | "id">,
  presence: PresenceBackend,
) {
  const username = socket.data.user?.username;
  if (!username) return;

  if (isPresenceStore(presence)) {
    await presence.refreshConnection?.(socket.id, username);
    return;
  }

  if (presence.has(socket.id)) {
    presence.set(socket.id, username);
  }
}

export async function removePresenceConnection(
  socket: Pick<PresenceSocket, "id">,
  broadcaster: PresenceBroadcaster,
  presence: PresenceBackend,
) {
  const previousUsernames = await getPresenceUsernames(presence);

  if (!isPresenceStore(presence) && !presence.has(socket.id)) return;

  const activeUsernames = await removePresenceConnectionFromBackend(presence, socket.id);
  if (!hasSameUsernames(previousUsernames, activeUsernames)) {
    broadcaster.emit("presence:update", activeUsernames);
  }
}
