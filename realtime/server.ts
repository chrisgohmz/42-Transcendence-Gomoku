import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Server as Engine } from "@socket.io/bun-engine";
import { config } from "dotenv";
import { Server } from "socket.io";

import { prisma } from "@/lib/prisma";

import { isGameUpdatePayload } from "../shared/match-events-validation";
import { registerMatchSubscription } from "./handlers/match-subscription";
import { resolveFriendshipNotificationTarget } from "./lib/friendship-notifications";
import { removePresenceConnection, subscribeToPresence, type ConnectedUsers } from "./lib/presence";
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

type QueuedPlayer = {
  socketId: string;
  userId: string;
};

let matchQueue: QueuedPlayer[] = [];

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);

  console.log(`[realtime] connected: ${socket.id}`);

  // REGISTER USER ROOM
  socket.on("register", (username: string) => {
    const authUsername = socket.data.user?.username;
    if (authUsername && authUsername === username) {
      void socket.join(`user:${username}`);
    }
  });

  const stopSocketLifecycle = startSocketLifecycle(socket, {
    heartbeatIntervalMs: socketHeartbeatIntervalMs,
  });

  subscribeToPresence(socket, io, connectedUsers);
  registerMatchSubscription(socket);

  socket.on("presence:subscribe", () => {
    subscribeToPresence(socket, io, connectedUsers);
  });

  // FRIENDSHIP LIVE REFRESH
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

      // REFRESH TARGET USER
      io.to(`user:${verifiedTargetUsername}`).emit("friendship:refresh");

      // REFRESH CURRENT USER
      io.to(`user:${senderUsername}`).emit("friendship:refresh");
    } catch (error) {
      console.error("Failed friendship notification", error);
    }
  });

  socket.on("queue:join", async () => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    matchQueue = matchQueue.filter(
      (player) => player.userId !== userId && player.socketId !== socket.id,
    );

    matchQueue.push({ socketId: socket.id, userId });
    console.log(`Player ${userId} joined the queue. Total waiting: ${matchQueue.length}`);

    if (matchQueue.length >= 2) {
      const player1 = matchQueue.shift()!;
      const player2 = matchQueue.shift()!;

      try {
        const match = await prisma.match.create({
          data: {
            status: "IN_PROGRESS",
            nextTurnSeat: "BLACK",
            participants: {
              create: [
                {
                  userId: player1.userId,
                  displayNameSnapshot: "Player 1",
                  role: "PLAYER",
                  seat: "BLACK",
                },
                {
                  userId: player2.userId,
                  displayNameSnapshot: "Player 2",
                  role: "PLAYER",
                  seat: "WHITE",
                },
              ],
            },
          },
        });

        io.to(player1.socketId).emit("queue:matched", {
          matchId: match.id,
        });

        io.to(player2.socketId).emit("queue:matched", {
          matchId: match.id,
        });

        console.log(`Created match ${match.id} for ${player1.userId} and ${player2.userId}`);
      } catch (error) {
        console.error("Failed to create match from queue", error);
      }
    }
  });

  socket.on("queue:leave", () => {
    matchQueue = matchQueue.filter((player) => player.socketId !== socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket.IO client disconnected: ${socket.id} (${reason})`);

    stopSocketLifecycle();
    matchQueue = matchQueue.filter((player) => player.socketId !== socket.id);

    removePresenceConnection(socket, io, connectedUsers);
  });
});

const engineHandler = engine.handler();

async function handleInternalGameUpdate(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!isGameUpdatePayload(payload)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const room = matchRoomId(payload.matchId);

  io.to(room).emit("game:update", payload);

  console.log(`[realtime] broadcast game:update to ${room}`);

  return Response.json({
    ok: true,
    room,
  });
}

Bun.serve({
  hostname,
  port,

  fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        service: "realtime",
        status: "ok",
        checkedAt: new Date().toISOString(),
      });
    }

    if (url.pathname === "/internal/game-update" && request.method === "POST") {
      return handleInternalGameUpdate(request);
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
