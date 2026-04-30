import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Server as Engine } from "@socket.io/bun-engine";
import { config } from "dotenv";
import { Server } from "socket.io";

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

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);
  console.log(`[realtime] connected: ${socket.id}`);

  registerMatchSubscription(socket);

  socket.on("disconnect", (reason) => {
    console.log(`Socket.IO client disconnected: ${socket.id} (${reason})`);
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
