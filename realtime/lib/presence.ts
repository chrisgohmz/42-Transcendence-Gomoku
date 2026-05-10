export type ConnectedUsers = Map<string, string>;

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

export function getActiveUsernames(connectedUsers: ConnectedUsers) {
  return Array.from(new Set(connectedUsers.values()));
}

function hasSameUsernames(left: string[], right: string[]) {
  if (left.length !== right.length) return false;

  const rightUsernames = new Set(right);
  return left.every((username) => rightUsernames.has(username));
}

export function subscribeToPresence(
  socket: PresenceSocket,
  broadcaster: PresenceBroadcaster,
  connectedUsers: ConnectedUsers,
) {
  const username = socket.data.user?.username;
  if (!username) return;

  const previousUsernames = getActiveUsernames(connectedUsers);

  void socket.join(`user:${username}`);
  connectedUsers.set(socket.id, username);

  const activeUsernames = getActiveUsernames(connectedUsers);
  if (hasSameUsernames(previousUsernames, activeUsernames)) {
    socket.emit("presence:update", activeUsernames);
    return;
  }

  broadcaster.emit("presence:update", activeUsernames);
}

export function removePresenceConnection(
  socket: Pick<PresenceSocket, "id">,
  broadcaster: PresenceBroadcaster,
  connectedUsers: ConnectedUsers,
) {
  if (!connectedUsers.has(socket.id)) return;

  const previousUsernames = getActiveUsernames(connectedUsers);

  connectedUsers.delete(socket.id);

  const activeUsernames = getActiveUsernames(connectedUsers);
  if (!hasSameUsernames(previousUsernames, activeUsernames)) {
    broadcaster.emit("presence:update", activeUsernames);
  }
}
