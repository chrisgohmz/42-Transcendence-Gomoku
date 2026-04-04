import "./lib/load-env";

import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env["NODE_ENV"] !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env["PORT"] || 3001);

// The custom server runs under Bun in dev, but Next's dev webpack path is more
// reliable here than Turbopack for Prisma + pg externals inside the backend app.
const app = next({
  dev,
  hostname,
  port,
  webpack: dev,
});
const handle = app.getRequestHandler();

function readCorsOrigins(): string[] {
  const configuredOrigins = process.env["SOCKET_CORS_ORIGIN"];

  if (!configuredOrigins) {
    return ["http://localhost:3000"];
  }

  return configuredOrigins.split(",").map((origin) => origin.trim());
}

async function bootstrap(): Promise<void> {
  await app.prepare();

  const server = createServer((request, response) => {
    void handle(request, response);
  });

  const io = new Server(server, {
    cors: {
      origin: readCorsOrigins(),
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.emit("welcome", {
      message: "Realtime backend is ready.",
    });
  });

  setInterval(() => {
    io.emit("heartbeat", {
      timestamp: new Date().toISOString(),
    });
  }, 15000);

  server.listen(port, hostname, () => {
    console.log(`Backend listening on http://${hostname}:${port}`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
