import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Server as Engine } from "@socket.io/bun-engine";
import { config } from "dotenv";
import { Server } from "socket.io";

import {
  cancelMatchmakingQueue,
  getGlobalMatchStats,
  type MatchmakingUser,
} from "@/lib/matches/matchmaking";
import { prisma } from "@/lib/prisma";

import {
  challengeDeclinedPath,
  challengeReceivedPath,
  chatMessagePath,
  readRealtimeInternalSecret,
} from "../shared/realtime-internal";
import { registerChatSubscription } from "./handlers/chat-subscription";
import { registerMatchSubscription } from "./handlers/match-subscription";
import { registerMatchmakingQueue } from "./handlers/matchmaking-queue";
import { resolveFriendshipNotificationTarget } from "./lib/friendship-notifications";
import { handleInternalChallengeDeclined } from "./lib/internal-challenge-declined";
import { handleInternalChallengeReceived } from "./lib/internal-challenge-received";
import { handleInternalChatMessage } from "./lib/internal-chat-message";
import { handleInternalFriendshipUpdate } from "./lib/internal-friendship-update";
import { handleInternalGameUpdate } from "./lib/internal-game-update";
import { handleInternalQueueMatched } from "./lib/internal-queue-matched";
import {
  createMemoryPresenceStore,
  refreshPresenceConnection,
  removePresenceConnection,
  subscribeToPresence,
  type ConnectedUsers,
} from "./lib/presence";
import { createRedisBackedPresenceStore, getRealtimeRedisErrorMessage } from "./lib/redis-presence";
import {
  createRemoteMatchConnectionManager,
  remotePlayReconnectWindowMs,
} from "./lib/remote-match-connections";
import { matchRoomId } from "./lib/rooms";
import { authenticateSocketSession } from "./lib/socket-auth";
import {
  DEFAULT_SOCKET_HEARTBEAT_INTERVAL_MS,
  DEFAULT_SOCKET_PING_INTERVAL_MS,
  DEFAULT_SOCKET_PING_TIMEOUT_MS,
  readPositiveIntegerEnv,
  startSocketLifecycle,
} from "./lib/socket-lifecycle";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const rootEnvPath = resolve(currentDirectory, "../.env");

if (existsSync(rootEnvPath)) {
  config({
    path: rootEnvPath,
    override: false,
  });
}

const hostname = process.env["SOCKET_HOST"] ?? "0.0.0.0";
const port = Number(process.env["SOCKET_PORT"] || 3001);
const socketPath = process.env["SOCKET_PATH"] ?? "/socket.io/";
const realtimeInternalSecret = readRealtimeInternalSecret(process.env);

if (!realtimeInternalSecret && process.env["NODE_ENV"] === "production") {
  throw new Error("REALTIME_INTERNAL_SECRET is required in production.");
}

const socketHeartbeatIntervalMs = readPositiveIntegerEnv(
  process.env,
  "SOCKET_HEARTBEAT_INTERVAL_MS",
  DEFAULT_SOCKET_HEARTBEAT_INTERVAL_MS,
);
const socketPingIntervalMs = readPositiveIntegerEnv(
  process.env,
  "SOCKET_PING_INTERVAL_MS",
  DEFAULT_SOCKET_PING_INTERVAL_MS,
);
const socketPingTimeoutMs = readPositiveIntegerEnv(
  process.env,
  "SOCKET_PING_TIMEOUT_MS",
  DEFAULT_SOCKET_PING_TIMEOUT_MS,
);
const realtimePresenceTtlSeconds = readPositiveIntegerEnv(
  process.env,
  "REALTIME_PRESENCE_TTL_SECONDS",
  Math.max(60, Math.ceil(socketHeartbeatIntervalMs / 1000) * 4),
);
const matchReconnectWindowMs = readPositiveIntegerEnv(
  process.env,
  "MATCH_RECONNECT_WINDOW_MS",
  remotePlayReconnectWindowMs,
);

function readCorsOrigins(): string[] {
  const configuredOrigins = process.env["SOCKET_CORS_ORIGIN"];

  if (!configuredOrigins) {
    return ["http://localhost:3000", "https://localhost:8443"];
  }

  return configuredOrigins.split(",").map((origin) => origin.trim());
}

const corsOrigins = readCorsOrigins();

const engine = new Engine({
  path: socketPath,
  pingInterval: socketPingIntervalMs,
  pingTimeout: socketPingTimeoutMs,
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const io = new Server({
  path: socketPath,
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.bind(engine);

io.use(authenticateSocketSession);

const connectedUsers: ConnectedUsers = new Map();
const connectedSocketIdsByUserId = new Map<string, Set<string>>();
const presenceStore =
  (await createRedisBackedPresenceStore({
    env: process.env,
    io,
    presenceTtlSeconds: realtimePresenceTtlSeconds,
  })) ?? createMemoryPresenceStore(connectedUsers);
const remoteMatchConnections = createRemoteMatchConnectionManager({
  broadcastGameUpdate: (payload) => {
    io.to(matchRoomId(payload.matchId)).emit("game:update", payload);
  },
  reconnectWindowMs: matchReconnectWindowMs,
});

type SocketUser = Partial<MatchmakingUser> & {
  id?: string;
};

function getMatchmakingUserFromSocket(socket: Parameters<typeof registerMatchmakingQueue>[0]) {
  const user = socket.data.user as SocketUser | undefined;

  if (!user?.id) {
    return null;
  }

  return {
    displayName: user.displayName ?? null,
    id: user.id,
    name: user.name ?? null,
    username: user.username ?? null,
  } satisfies MatchmakingUser;
}

function logPresenceError(action: string, error: unknown) {
  console.error(`[realtime] Failed to ${action} presence: ${getRealtimeRedisErrorMessage(error)}`);
}

function subscribeSocketToPresence(socket: Parameters<typeof subscribeToPresence>[0]) {
  void subscribeToPresence(socket, io, presenceStore).catch((error: unknown) => {
    logPresenceError("subscribe to", error);
  });
}

function addConnectedUserSocket(userId: string, socketId: string) {
  const socketIds = connectedSocketIdsByUserId.get(userId) ?? new Set<string>();
  socketIds.add(socketId);
  connectedSocketIdsByUserId.set(userId, socketIds);
}

function removeConnectedUserSocket(userId: string, socketId: string) {
  const socketIds = connectedSocketIdsByUserId.get(userId);
  if (!socketIds) {
    return true;
  }

  socketIds.delete(socketId);

  if (socketIds.size > 0) {
    return false;
  }

  connectedSocketIdsByUserId.delete(userId);
  return true;
}

async function broadcastGlobalMatchStats() {
  const stats = await getGlobalMatchStats();
  io.emit("stats:update", stats);
}

async function abandonQueueForDisconnectedUser(user: MatchmakingUser) {
  try {
    const result = await cancelMatchmakingQueue(user);

    if (result.kind !== "cancelled") {
      return;
    }

    console.log(`[realtime] cancelled abandoned queue match ${result.matchId} for ${user.id}`);
    await broadcastGlobalMatchStats();
  } catch (error) {
    console.error("[realtime] failed to abandon disconnected queue:", error);
  }
}

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);

  console.log(`[realtime] connected: ${socket.id}`);
  const matchmakingUser = getMatchmakingUserFromSocket(socket);
  if (matchmakingUser) {
    addConnectedUserSocket(matchmakingUser.id, socket.id);
  }

  socket.on("register", (username: string) => {
    const authUsername = socket.data.user?.username;
    if (authUsername && authUsername === username) {
      void socket.join(`user:${username}`);
    }
  });

  const stopSocketLifecycle = startSocketLifecycle(socket, {
    heartbeatIntervalMs: socketHeartbeatIntervalMs,
    onHeartbeat: () =>
      refreshPresenceConnection(socket, presenceStore).catch((error: unknown) => {
        logPresenceError("refresh", error);
      }),
  });

  subscribeSocketToPresence(socket);
  registerMatchmakingQueue(socket, io);
  registerMatchSubscription(socket, prisma, {
    onSubscribed: (subscription) => {
      remoteMatchConnections.registerSubscription(subscription);
    },
  });
  registerChatSubscription(socket);

  socket.on("presence:subscribe", () => {
    subscribeSocketToPresence(socket);
  });

  socket.on("friendship:notify", async (targetUsername: string) => {
    try {
      const senderId = socket.data.user?.id;
      const senderUsername = socket.data.user?.username;
      if (!senderId || !senderUsername) return;

      const verifiedTargetUsername = await resolveFriendshipNotificationTarget(
        prisma,
        senderId,
        targetUsername,
      );
      if (!verifiedTargetUsername) return;

      io.to(`user:${verifiedTargetUsername}`).emit("friendship:refresh");

      io.to(`user:${senderUsername}`).emit("friendship:refresh");
    } catch (error) {
      console.error("Failed friendship notification", error);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket.IO client disconnected: ${socket.id} (${reason})`);

    stopSocketLifecycle();
    remoteMatchConnections.handleSocketDisconnect(socket.id);

    if (matchmakingUser && removeConnectedUserSocket(matchmakingUser.id, socket.id)) {
      void abandonQueueForDisconnectedUser(matchmakingUser);
    }

    void removePresenceConnection(socket, io, presenceStore).catch((error: unknown) => {
      logPresenceError("remove", error);
    });
  });
});

const engineHandler = engine.handler();

Bun.serve({
  hostname,
  port,

  async fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        service: "realtime",
        status: "ok",
        checkedAt: new Date().toISOString(),
      });
    }

    if (url.pathname === "/internal/game-update" && request.method === "POST") {
      return handleInternalGameUpdate(request, io, realtimeInternalSecret);
    }

    if (url.pathname === "/internal/friendship-update" && request.method === "POST") {
      return handleInternalFriendshipUpdate(request, io, realtimeInternalSecret);
    }

    if (url.pathname === "/internal/queue-matched" && request.method === "POST") {
      return handleInternalQueueMatched(request, io, realtimeInternalSecret);
    }

    if (url.pathname === challengeDeclinedPath && request.method === "POST") {
      return handleInternalChallengeDeclined(request, io, realtimeInternalSecret);
    }

    if (url.pathname === challengeReceivedPath && request.method === "POST") {
      return handleInternalChallengeReceived(request, io, realtimeInternalSecret);
    }

    if (url.pathname === chatMessagePath && request.method === "POST") {
      return handleInternalChatMessage(request, io, realtimeInternalSecret);
    }

    if (url.pathname === socketPath) {
      return engine.handleRequest(request, server);
    }

    return new Response("Not Found", {
      status: 404,
    });
  },

  websocket: engineHandler.websocket,

  idleTimeout: engineHandler.idleTimeout,

  maxRequestBodySize: engineHandler.maxRequestBodySize,
});

console.log(
  `Realtime server listening on http://${hostname}:${port} with Socket.IO at ${socketPath}`,
);
