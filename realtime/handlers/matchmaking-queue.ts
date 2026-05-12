import type { Server, Socket } from "socket.io";

import {
  cancelMatchmakingQueue,
  type JoinMatchmakingQueueResult,
  type MatchmakingUser,
  type MatchmakingSession,
  joinMatchmakingQueue,
} from "@/lib/matches/matchmaking";

type SocketUser = Partial<MatchmakingUser> & {
  id?: string;
};

function getAuthenticatedUser(socket: Socket): MatchmakingUser | null {
  const user = socket.data.user as SocketUser | undefined;

  if (!user?.id) {
    return null;
  }

  return {
    displayName: user.displayName ?? null,
    id: user.id,
    name: user.name ?? null,
    username: user.username ?? null,
  };
}

function emitMatched(socket: Socket, session: MatchmakingSession) {
  socket.emit("queue:matched", session);
  socket.emit("queue:status", {
    kind: "matched",
    session,
  });
}

function emitJoinResult(socket: Socket, io: Server, result: JoinMatchmakingQueueResult) {
  if (result.kind === "queued") {
    socket.emit("queue:status", {
      kind: "queued",
      queuePosition: result.queuePosition,
      session: result.session,
    });
    return;
  }

  emitMatched(socket, result.session);

  if (result.opponent?.username) {
    io.to(`user:${result.opponent.username}`).emit("queue:matched", result.opponent.session);
    io.to(`user:${result.opponent.username}`).emit("queue:status", {
      kind: "matched",
      session: result.opponent.session,
    });
  }
}

export function registerMatchmakingQueue(socket: Socket, io: Server) {
  socket.on("queue:join", async () => {
    const user = getAuthenticatedUser(socket);

    if (!user) {
      socket.emit("queue:error", { error: "unauthorized" });
      return;
    }

    try {
      emitJoinResult(socket, io, await joinMatchmakingQueue(user));
    } catch (error) {
      console.error("Failed to join matchmaking queue", error);
      socket.emit("queue:error", { error: "failed_to_join_queue" });
    }
  });

  socket.on("queue:leave", async () => {
    const user = getAuthenticatedUser(socket);

    if (!user) {
      socket.emit("queue:error", { error: "unauthorized" });
      return;
    }

    try {
      const result = await cancelMatchmakingQueue(user);
      socket.emit("queue:status", result);
    } catch (error) {
      console.error("Failed to leave matchmaking queue", error);
      socket.emit("queue:error", { error: "failed_to_cancel_queue" });
    }
  });
}
