import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDirectory, ".env");

config({ path: rootEnvPath, override: false });

const databaseUrl =
  process.env["DATABASE_URL"] ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "bun --bun prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
