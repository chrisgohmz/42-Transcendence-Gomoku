import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { z } from "zod";

import type { User } from "../../generated/prisma/client";
import type { DuplicateSignupFields } from "./auth-duplicate-fields";
import { prisma } from "./prisma";
import { authValidationLimits } from "./validation/auth-profile-limits";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_REFRESH_SECONDS = 24 * 60 * 60;
const usernamePattern = /^[A-Za-z0-9_-]+$/;

export const auth = betterAuth({
  appName: "42 Transcendence Gomoku",
  baseURL: process.env["BETTER_AUTH_URL"],
  secret: process.env["BETTER_AUTH_SECRET"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: authValidationLimits.passwordMinLength,
    maxPasswordLength: authValidationLimits.passwordMaxLength,
  },
  user: {
    modelName: "User",
    fields: {
      image: "avatarUrl",
      name: "displayName",
    },
    additionalFields: {
      username: {
        type: "string",
        required: true,
        validator: {
          input: z
            .string()
            .min(authValidationLimits.usernameMinLength)
            .max(authValidationLimits.usernameMaxLength)
            .regex(usernamePattern),
        },
      },
    },
  },
  session: {
    modelName: "UserSession",
    fields: {
      token: "sessionToken",
    },
    expiresIn: SESSION_TTL_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
    freshAge: 0,
  },
  account: {
    modelName: "Account",
  },
  verification: {
    modelName: "Verification",
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.userProfile
            .create({
              data: { userId: user.id },
            })
            .catch(() => null);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

type BetterAuthSessionData = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type AuthContext = {
  session: BetterAuthSessionData["session"];
  user: User;
};

export async function getCurrentSession(): Promise<AuthContext | null> {
  const sessionData = await auth.api.getSession({
    headers: await headers(),
  });

  if (!sessionData) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionData.user.id },
  });

  if (!user) {
    return null;
  }

  return { session: sessionData.session, user };
}

export async function getDuplicateSignupFields(
  email: string,
  username: string,
): Promise<DuplicateSignupFields> {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ email }, { username }],
    },
    select: {
      email: true,
      username: true,
    },
  });

  const fields: DuplicateSignupFields = {};

  for (const user of users) {
    if (user.email === email) {
      fields.email = true;
    }

    if (user.username === username) {
      fields.username = true;
    }
  }

  return fields;
}

export function serializeUserForResponse(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified || Boolean(user.emailVerifiedAt),
  };
}
