import "./load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaPool: Pool | undefined;
}

function getPrisma(): PrismaClient {
  if (globalThis.prisma) {
    return globalThis.prisma;
  }

  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined.");
  }

  const pool =
    globalThis.prismaPool ??
    new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
    });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  if (process.env["NODE_ENV"] !== "production") {
    globalThis.prismaPool = pool;
    globalThis.prisma = prisma;
  }

  return prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get: (_target, prop, receiver) => Reflect.get(getPrisma(), prop, receiver),
  set: (_target, prop, value, receiver) =>
    Reflect.set(getPrisma(), prop, value, receiver),
  has: (_target, prop) => prop in getPrisma(),
  ownKeys: () => Reflect.ownKeys(getPrisma()),
  getOwnPropertyDescriptor: (_target, prop) =>
    Object.getOwnPropertyDescriptor(getPrisma(), prop),
});
