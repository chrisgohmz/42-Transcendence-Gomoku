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
  join(room: string): unknown;
};

export function getActiveUsernames(connectedUsers: ConnectedUsers) {
  return Array.from(new Set(connectedUsers.values()));
}

export function subscribeToPresence(
  socket: PresenceSocket,
  broadcaster: PresenceBroadcaster,
  connectedUsers: ConnectedUsers,
) {
  const username = socket.data.user?.username;
  if (!username) return;

  void socket.join(`user:${username}`);
  connectedUsers.set(socket.id, username);
  broadcaster.emit("presence:update", getActiveUsernames(connectedUsers));
}

export function removePresenceConnection(
  socket: Pick<PresenceSocket, "id">,
  broadcaster: PresenceBroadcaster,
  connectedUsers: ConnectedUsers,
) {
  if (!connectedUsers.has(socket.id)) return;

  connectedUsers.delete(socket.id);
  broadcaster.emit("presence:update", getActiveUsernames(connectedUsers));
}
