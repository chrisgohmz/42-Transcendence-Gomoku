import { prisma } from "../../../lib/prisma";
import {
  clearSessionCookie,
  createSession,
  handlePrismaUniqueError,
  hashPassword,
  serializeUserForResponse,
} from "../../../lib/auth";

export const dynamic = "force-dynamic";

type SignupBody = {
  email?: string;
  password?: string;
  username?: string;
  displayName?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function validatePayload(body: SignupBody): { error?: string } {
  const email = body.email?.trim();
  const password = body.password?.trim();
  const username = body.username?.trim();

  if (!email || !password || !username) {
    return { error: "Email, username, and password are required." };
  }

  if (!email.includes("@") || !email.includes(".")) {
    return { error: "Please enter a valid email address." };
  }

  if (username.length < 3) {
    return { error: "Username must be at least 3 characters long." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  return {};
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignupBody | null;

  if (!body) {
    return Response.json(
      { error: "invalid_request", message: "Invalid request body." },
      { status: 400 },
    );
  }

  const validation = validatePayload(body);

  if (validation.error) {
    return Response.json(
      { error: "invalid_request", message: validation.error },
      { status: 400 },
    );
  }

  const email = normalizeEmail(body.email!);
  const username = normalizeUsername(body.username!);
  const displayName = (body.displayName ?? username).trim() || username;

  try {
    const passwordHash = await hashPassword(body.password!);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        profile: {
          create: {},
        },
      },
    });

    await createSession(user.id, request);

    return Response.json(
      { user: serializeUserForResponse(user) },
      { status: 201 },
    );
  } catch (error) {
    const duplicateResponse = handlePrismaUniqueError(error, [
      "email",
      "username",
    ]);

    if (duplicateResponse) {
      return duplicateResponse;
    }

    await clearSessionCookie();

    return Response.json(
      {
        error: "signup_failed",
        message: "Unable to create your account right now.",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
