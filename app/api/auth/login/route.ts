import { prisma } from "../../../lib/prisma";
import {
  clearSessionCookie,
  createSession,
  serializeUserForResponse,
  verifyPassword,
} from "../../../lib/auth";

export const dynamic = "force-dynamic";

type LoginBody = {
  email?: string;
  password?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;

  if (!body?.email || !body.password) {
    return Response.json(
      {
        error: "invalid_credentials",
        message: "Invalid email or password.",
      },
      { status: 401 },
    );
  }

  const email = normalizeEmail(body.email);
  const password = body.password.trim();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    const isValid =
      user && (await verifyPassword(password, user.passwordHash ?? null));

    if (!user || !isValid) {
      await clearSessionCookie();
      return Response.json(
        {
          error: "invalid_credentials",
          message: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    await createSession(user.id, request);

    return Response.json({ user: serializeUserForResponse(user) });
  } catch (error) {
    await clearSessionCookie();

    return Response.json(
      {
        error: "login_failed",
        message: "Unable to sign you in right now.",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
