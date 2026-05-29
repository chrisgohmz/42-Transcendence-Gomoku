import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Server as Engine } from "@socket.io/bun-engine";
import { config } from "dotenv";
import { Server } from "socket.io";

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
const presenceStore =
  (await createRedisBackedPresenceStore({
    env: process.env,
    io,
    presenceTtlSeconds: realtimePresenceTtlSeconds,
  })) ?? createMemoryPresenceStore(connectedUsers);

function logPresenceError(action: string, error: unknown) {
  console.error(`[realtime] Failed to ${action} presence: ${getRealtimeRedisErrorMessage(error)}`);
}

function subscribeSocketToPresence(socket: Parameters<typeof subscribeToPresence>[0]) {
  void subscribeToPresence(socket, io, presenceStore).catch((error: unknown) => {
    logPresenceError("subscribe to", error);
  });
}

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);

  console.log(`[realtime] connected: ${socket.id}`);

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
  registerMatchSubscription(socket);
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
