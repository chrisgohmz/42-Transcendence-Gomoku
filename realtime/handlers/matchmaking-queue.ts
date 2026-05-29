import type { Server, Socket } from "socket.io";

import {
  cancelMatchmakingQueue,
  type JoinMatchmakingQueueResult,
  type MatchmakingSession,
  joinMatchmakingQueue,
  getGlobalMatchStats,
} from "@/lib/matches/matchmaking";

import { getMatchmakingUserFromSocket } from "../lib/socket-matchmaking-user";

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

async function broadcastStats(io: Server) {
  try {
    const stats = await getGlobalMatchStats();
    io.emit("stats:update", stats);
  } catch (error) {
    console.error("Failed to broadcast stats", error);
  }
}

export function registerMatchmakingQueue(socket: Socket, io: Server) {
  socket.on("stats:request", async () => {
    try {
      const stats = await getGlobalMatchStats();
      socket.emit("stats:update", stats);
    } catch (error) {
      console.error("Failed to fetch initial stats", error);
    }
  });

  socket.on("queue:join", async () => {
    const user = getMatchmakingUserFromSocket(socket);

    if (!user) {
      socket.emit("queue:error", { error: "unauthorized" });
      return;
    }

    try {
      emitJoinResult(socket, io, await joinMatchmakingQueue(user));
      await broadcastStats(io);
    } catch (error) {
      console.error("Failed to join matchmaking queue", error);
      socket.emit("queue:error", { error: "failed_to_join_queue" });
    }
  });

  socket.on("queue:leave", async () => {
    const user = getMatchmakingUserFromSocket(socket);

    if (!user) {
      socket.emit("queue:error", { error: "unauthorized" });
      return;
    }

    try {
      const result = await cancelMatchmakingQueue(user);
      socket.emit("queue:status", result);
      await broadcastStats(io);
    } catch (error) {
      console.error("Failed to leave matchmaking queue", error);
      socket.emit("queue:error", { error: "failed_to_cancel_queue" });
    }
  });
}
