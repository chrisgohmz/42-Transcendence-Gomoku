import "server-only";

import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { cookies, headers } from "next/headers";
import { promisify } from "node:util";

import type { Prisma, User, UserSession } from "../../generated/prisma/client";
import { prisma } from "./prisma";

const SESSION_COOKIE_NAME = "gomoku_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day
const HASH_LENGTH = 64;
const SALT_LENGTH = 16;
const scrypt = promisify(nodeScrypt);

type AuthContext = {
  user: User;
  session: UserSession;
};

function readCookieDomain(): string | undefined {
  const domain = process.env["AUTH_COOKIE_DOMAIN"]?.trim();
  return domain ? domain : undefined;
}

function isSecure(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function getClientIp(headersList: Headers): string | undefined {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || undefined;
  }

  const direct = headersList.get("x-real-ip");
  return direct ?? undefined;
}

async function getRequestHeaders(request?: Request): Promise<Headers> {
  if (request) {
    return request.headers;
  }

  return new Headers(await headers());
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scrypt(password, salt, HASH_LENGTH)) as Buffer;

  return `${salt.toString("base64")}:${derivedKey.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  const [salt, storedHash] = passwordHash.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const saltBuffer = Buffer.from(salt, "base64");
  const storedHashBuffer = Buffer.from(storedHash, "base64");
  const derivedKey = (await scrypt(
    password,
    saltBuffer,
    storedHashBuffer.length,
  )) as Buffer;

  if (derivedKey.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedHashBuffer, derivedKey);
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();

  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
    domain: readCookieDomain(),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();

  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
    domain: readCookieDomain(),
  });
}

export async function createSession(userId: string, request?: Request) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const sessionToken = createId();
  const requestHeaders = await getRequestHeaders(request);

  await prisma.userSession.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
      ipAddress: getClientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? undefined,
    },
  });

  await setSessionCookie(sessionToken, expiresAt);
}

export async function revokeSession(sessionToken: string) {
  await prisma.userSession.updateMany({
    where: { sessionToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentSession(): Promise<AuthContext | null> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { sessionToken },
    include: { user: true },
  });

  if (!session || session.revokedAt) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return { user: session.user, session };
}

export async function refreshSessionIfNeeded(
  context: AuthContext,
): Promise<void> {
  const remainingMs = context.session.expiresAt.getTime() - Date.now();

  if (remainingMs > SESSION_REFRESH_THRESHOLD_MS) {
    return;
  }

  const nextExpiry = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.userSession.update({
    where: { id: context.session.id },
    data: { expiresAt: nextExpiry },
  });

  await setSessionCookie(context.session.sessionToken, nextExpiry);
}

export function serializeUserForResponse(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

export function handlePrismaUniqueError(
  error: unknown,
  fields?: string[],
): Response | null {
  const prismaError = error as Prisma.PrismaClientKnownRequestError;

  if (prismaError?.code !== "P2002") {
    return null;
  }

  const targetMeta = prismaError.meta?.["target"];
  const target = Array.isArray(targetMeta) ? targetMeta.join(", ") : undefined;
  const uniqueFields = fields?.join(", ") ?? target ?? "fields";

  return Response.json(
    {
      error: "duplicate",
      message: `An account with those ${uniqueFields} already exists.`,
    },
    { status: 409 },
  );
}
