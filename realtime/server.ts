import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Server as Engine } from "@socket.io/bun-engine";
import { config } from "dotenv";
import { Server } from "socket.io";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { isGameUpdatePayload } from "../shared/match-events-validation";
import { registerMatchSubscription } from "./handlers/match-subscription";
import { matchRoomId } from "./lib/rooms";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDirectory, "../.env");

if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath, override: false });
}

const hostname = process.env["SOCKET_HOST"] ?? "0.0.0.0";
const port = Number(process.env["SOCKET_PORT"] || 3001);
const socketPath = process.env["SOCKET_PATH"] ?? "/socket.io/";

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
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});

const io = new Server({
  path: socketPath,
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});

io.bind(engine);

// 1. Secure Authentication Middleware
io.use(async (socket, next) => {
  try {
    const webHeaders = new Headers();
    for (const [key, value] of Object.entries(socket.request.headers)) {
      if (typeof value === "string") {
        webHeaders.append(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((v) => webHeaders.append(key, v));
      }
    }

    const sessionData = await auth.api.getSession({
      headers: webHeaders,
    });

    if (!sessionData) {
      return next(new Error("unauthorized"));
    }

    socket.data.user = sessionData.user;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

const connectedUsers = new Map<string, string>();

type QueuedPlayer = {
  socketId: string;
  userId: string;
};
let matchQueue: QueuedPlayer[] = [];

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);
  console.log(`[realtime] connected: ${socket.id}`);

  registerMatchSubscription(socket);

  socket.on("presence:subscribe", () => {
    const username = socket.data.user?.username;
    if (!username) return;

    void socket.join(`user:${username}`);
    connectedUsers.set(socket.id, username);
    const activeUsernames = Array.from(new Set(connectedUsers.values()));
    io.emit("presence:update", activeUsernames);
  });

  socket.on("friendship:notify", async (targetUsername: string) => {
    const senderId = socket.data.user?.id;
    if (!senderId) return;

    try {
      const target = await prisma.user.findUnique({ where: { username: targetUsername } });
      if (!target) return;

      const userLowId = senderId < target.id ? senderId : target.id;
      const userHighId = senderId < target.id ? target.id : senderId;

      const friendship = await prisma.friendship.findUnique({
        where: { userLowId_userHighId: { userLowId, userHighId } },
      });

      if (friendship) {
        io.to(`user:${targetUsername}`).emit("friendship:refresh");
      }
    } catch (error) {
      console.error("Failed to verify friendship notification", error);
    }
  });

  socket.on("queue:join", async (userId: string) => {
    if (!userId) return;

    if (matchQueue.some((player) => player.userId === userId)) {
      return;
    }

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

        io.to(player1.socketId).emit("queue:matched", { matchId: match.id });
        io.to(player2.socketId).emit("queue:matched", { matchId: match.id });
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

    matchQueue = matchQueue.filter((player) => player.socketId !== socket.id);

    if (connectedUsers.has(socket.id)) {
      connectedUsers.delete(socket.id);
      const activeUsernames = Array.from(new Set(connectedUsers.values()));
      io.emit("presence:update", activeUsernames);
    }
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
  return Response.json({ ok: true, room });
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

    return new Response("Not Found", { status: 404 });
  },
  websocket: engineHandler.websocket,
  idleTimeout: engineHandler.idleTimeout,
  maxRequestBodySize: engineHandler.maxRequestBodySize,
});

console.log(
  `Realtime server listening on http://${hostname}:${port} with Socket.IO at ${socketPath}`,
);
