const http = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3001);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function readCorsOrigins() {
  const configuredOrigins = process.env.SOCKET_CORS_ORIGIN;

  if (!configuredOrigins) {
    return ["http://localhost:3000"];
  }

  return configuredOrigins.split(",").map((origin) => origin.trim());
}

async function bootstrap() {
  await app.prepare();

  const server = http.createServer((request, response) => {
    handle(request, response);
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

bootstrap().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
