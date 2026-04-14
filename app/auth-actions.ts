"use server";

import { redirect } from "next/navigation";

import { prisma } from "./lib/prisma";
import type { LoginActionState, SignupActionState } from "./auth-action-state";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  verifyPassword,
} from "./lib/auth";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "").trim();

  if (!email.trim() || !password) {
    await clearSessionCookie();

    return {
      email,
      message: "Invalid email or password.",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    const isValid =
      user && (await verifyPassword(password, user.passwordHash ?? null));

    if (!user || !isValid) {
      await clearSessionCookie();

      return {
        email,
        message: "Invalid email or password.",
      };
    }

    await createSession(user.id);
  } catch {
    await clearSessionCookie();

    return {
      email,
      message: "Unable to sign you in right now.",
    };
  }

  redirect("/account");
}

export async function signupAction(
  _previousState: SignupActionState,
  formData: FormData,
): Promise<SignupActionState> {
  const email = String(formData.get("email") ?? "");
  const username = String(formData.get("username") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const password = String(formData.get("password") ?? "").trim();

  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);
  const normalizedDisplayName = displayName.trim() || normalizedUsername;

  if (!normalizedEmail || !normalizedUsername || !password) {
    return {
      displayName,
      email,
      message: "Email, username, and password are required.",
      username,
    };
  }

  if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
    return {
      displayName,
      email,
      message: "Please enter a valid email address.",
      username,
    };
  }

  if (normalizedUsername.length < 3) {
    return {
      displayName,
      email,
      message: "Username must be at least 3 characters long.",
      username,
    };
  }

  if (password.length < 8) {
    return {
      displayName,
      email,
      message: "Password must be at least 8 characters long.",
      username,
    };
  }

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        passwordHash,
        profile: {
          create: {},
        },
      },
    });

    await createSession(user.id);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        displayName,
        email,
        message: "An account with that email or username already exists.",
        username,
      };
    }

    await clearSessionCookie();

    return {
      displayName,
      email,
      message: "Unable to create your account right now.",
      username,
    };
  }

  redirect("/account");
}
