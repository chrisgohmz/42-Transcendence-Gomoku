import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDirectory, "../../.env");

config({ path: rootEnvPath, override: false });

const databaseUrl =
  process.env["DATABASE_URL"] ??
  (process.env["CI"]
    ? "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
    : undefined);

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: databaseUrl ?? env("DATABASE_URL"),
  },
});
