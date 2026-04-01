import { createConnection } from "node:net";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not defined.");
  process.exit(1);
}

const parsedUrl = new URL(databaseUrl);
const host = parsedUrl.hostname;
const port = Number(parsedUrl.port || 5432);
const retries = Number(process.env.DB_WAIT_RETRIES || 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 2000);

function sleep(duration: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function tryConnect(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port }, () => {
      socket.end();
      resolve();
    });

    socket.setTimeout(2000, () => {
      socket.destroy();
      reject(new Error("Timed out while waiting for the database port."));
    });

    socket.on("error", (error) => {
      socket.destroy();
      reject(error);
    });
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function waitForDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await tryConnect();
      console.log(`Database is reachable on ${host}:${port}.`);
      return;
    } catch (error) {
      console.log(
        `Database not ready yet (${attempt}/${retries}): ${getErrorMessage(error)}`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Database did not become reachable after ${retries} attempts.`,
  );
}

waitForDatabase().catch((error: unknown) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
