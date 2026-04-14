import "./app/lib/load-env";

import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env["NODE_ENV"] !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env["PORT"] || 3000);
const socketIoDisabled = process.env["DISABLE_SOCKET_IO"] === "1";

// The custom server runs under Bun in dev, but Next's dev webpack path is more
// reliable here than Turbopack for Prisma + pg externals in this app.
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

  if (!socketIoDisabled) {
    new Server(server, {
      cors: {
        origin: readCorsOrigins(),
        methods: ["GET", "POST"],
      },
    });
  }

  server.listen(port, hostname, () => {
    console.log(
      `App listening on http://${hostname}:${port}${socketIoDisabled ? " (Socket.IO disabled)" : ""}`,
    );
  });
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start app:", error);
  process.exit(1);
});
