import { randomUUID } from "node:crypto";

import { redisStorage } from "@better-auth/redis-storage";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { z } from "zod";

import type { User } from "../../generated/prisma/client";
import { getSharedRedisClient, readRedisUrl } from "../../shared/server/redis";
import { defaultLocale } from "../i18n/config";
import type { DuplicateSignupFields } from "./auth-duplicate-fields";
import {
  getConfiguredAuthBaseUrl,
  getTrustedAuthHosts,
  getTrustedAuthOrigins,
} from "./auth-origins";
import { authCredentialPolicy } from "./auth-policy";
import {
  createAuthSessionAccessors,
  type AuthContext as BaseAuthContext,
  type AuthSessionIdentity as BaseAuthSessionIdentity,
  type AuthSessionUser,
  type SessionLookupOptions,
} from "./auth-session-access";
import { oauthProviderIds, type OAuthProviderId } from "./oauth-providers";
import { prisma } from "./prisma";
import { authValidationLimits } from "./validation/auth-profile-limits";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_REFRESH_SECONDS = 24 * 60 * 60;
const SESSION_COOKIE_CACHE_SECONDS = 60;
const usernamePattern = /^[A-Za-z0-9_-]+$/;
const OAUTH_USERNAME_SUFFIX_LENGTH = 6;

type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

type GitHubOAuthProfile = {
  avatar_url?: string | null;
  email?: string | null;
  id: number | string;
  login?: string | null;
  name?: string | null;
};

type GoogleOAuthProfile = {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  sub: string;
};

function getOAuthCredentials(provider: OAuthProviderId): OAuthCredentials | null {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getConfiguredOAuthProviders(): OAuthProviderId[] {
  return oauthProviderIds.filter((provider) => Boolean(getOAuthCredentials(provider)));
}

function normalizeUsernameCandidate(candidate: string | null | undefined): string | null {
  const normalized = candidate
    ?.normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, authValidationLimits.usernameMaxLength);

  if (!normalized || normalized.length < authValidationLimits.usernameMinLength) {
    return null;
  }

  return normalized;
}

function trimUsernameBase(base: string, suffix: string): string {
  const separatorLength = 1;
  const maxBaseLength = authValidationLimits.usernameMaxLength - separatorLength - suffix.length;

  return base.slice(0, Math.max(authValidationLimits.usernameMinLength, maxBaseLength));
}

async function getAvailableOAuthUsername(
  provider: OAuthProviderId,
  providerAccountId: string,
  candidates: (string | null | undefined)[],
): Promise<string> {
  const suffix =
    normalizeUsernameCandidate(providerAccountId)?.slice(0, OAUTH_USERNAME_SUFFIX_LENGTH) ??
    provider;
  const fallback = `${provider}_${suffix}`;
  const bases = [
    ...candidates.map(normalizeUsernameCandidate),
    normalizeUsernameCandidate(fallback),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const base of bases) {
    const dedupedCandidates = [
      base,
      `${trimUsernameBase(base, suffix)}_${suffix}`,
      `${trimUsernameBase(base, `${provider}_${suffix}`)}_${provider}_${suffix}`,
    ];

    for (const username of dedupedCandidates) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });

      if (!existingUser) {
        return username;
      }
    }
  }

  return `${provider}_${randomUUID().replaceAll("-", "").slice(0, 12)}`.slice(
    0,
    authValidationLimits.usernameMaxLength,
  );
}

function getEmailLocalPart(email: string | null | undefined): string | null {
  return email?.split("@")[0] ?? null;
}

function getOAuthDisplayName(...candidates: (string | null | undefined)[]): string {
  return candidates.find((candidate) => candidate?.trim())?.trim() ?? "Gomoku Player";
}

function getPasswordResetUrl(url: string, token: string): string {
  const fallbackBaseUrl = process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000";
  const fallbackUrl = new URL(`/${defaultLocale}/reset-password`, fallbackBaseUrl);

  try {
    const authUrl = new URL(url);
    const callbackUrl = authUrl.searchParams.get("callbackURL");
    const resetUrl = callbackUrl ? new URL(callbackUrl) : fallbackUrl;
    resetUrl.searchParams.set("token", token);
    return resetUrl.toString();
  } catch {
    fallbackUrl.searchParams.set("token", token);
    return fallbackUrl.toString();
  }
}

const githubCredentials = getOAuthCredentials("github");
const googleCredentials = getOAuthCredentials("google");
const trustedOrigins = getTrustedAuthOrigins();
const betterAuthRateLimitEnabled =
  process.env["BETTER_AUTH_RATE_LIMIT_ENABLED"] === "true" ||
  process.env["NODE_ENV"] === "production";
const betterAuthRedisUrl = readRedisUrl(process.env, ["BETTER_AUTH_REDIS_URL", "REDIS_URL"]);
const betterAuthRedisClient = betterAuthRedisUrl
  ? getSharedRedisClient({
      cacheKey: "better-auth",
      connectTimeoutEnvName: "BETTER_AUTH_REDIS_CONNECT_TIMEOUT_MS",
      enableOfflineQueue: true,
      env: process.env,
      url: betterAuthRedisUrl,
      warningMessage: "[auth] Redis secondary storage is unavailable.",
    })
  : null;
const betterAuthSecondaryStorage = betterAuthRedisClient
  ? redisStorage({
      client: betterAuthRedisClient,
      keyPrefix: process.env["BETTER_AUTH_REDIS_KEY_PREFIX"]?.trim() || "better-auth:",
    })
  : undefined;

function getBetterAuthBaseUrl() {
  const fallback = getConfiguredAuthBaseUrl() ?? trustedOrigins[0];
  const allowedHosts = getTrustedAuthHosts();

  if (allowedHosts.length > 0) {
    return {
      allowedHosts,
      fallback,
      protocol: "auto" as const,
    };
  }

  return fallback ?? process.env["BETTER_AUTH_URL"];
}

export const auth = betterAuth({
  appName: "Gomoku Heroes",
  baseURL: getBetterAuthBaseUrl(),
  secret: process.env["BETTER_AUTH_SECRET"],
  trustedOrigins,
  secondaryStorage: betterAuthSecondaryStorage,
  rateLimit: {
    enabled: betterAuthRateLimitEnabled,
    storage: betterAuthSecondaryStorage ? "secondary-storage" : "memory",
    window: 60,
    max: 100,
    customRules: {
      "/request-password-reset": {
        window: 60,
        max: 3,
      },
      "/sign-in/email": {
        window: 10,
        max: 3,
      },
      "/sign-up/email": {
        window: 60,
        max: 5,
      },
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: authCredentialPolicy.emailAndPassword.requireEmailVerification,
    minPasswordLength: authValidationLimits.passwordMinLength,
    maxPasswordLength: authValidationLimits.passwordMaxLength,
    revokeSessionsOnPasswordReset:
      authCredentialPolicy.emailAndPassword.revokeSessionsOnPasswordReset,
    sendResetPassword: async ({ user, url, token }) => {
      try {
        const { sendPasswordResetEmail } = await import("./auth-email");
        await sendPasswordResetEmail({
          email: user.email,
          resetUrl: getPasswordResetUrl(url, token),
        });
      } catch (error) {
        console.error("Failed to send password reset email", error);
        throw error;
      }
    },
  },
  emailVerification: {
    sendOnSignUp: authCredentialPolicy.emailVerification.sendOnSignUp,
    sendOnSignIn: authCredentialPolicy.emailVerification.sendOnSignIn,
    autoSignInAfterVerification: authCredentialPolicy.emailVerification.autoSignInAfterVerification,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const { sendEmailVerificationEmail } = await import("./auth-email");
        await sendEmailVerificationEmail({
          email: user.email,
          verificationUrl: url,
        });
      } catch (error) {
        console.error("Failed to send verification email", error);
        throw error;
      }
    },
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
    cookieCache: {
      enabled: true,
      maxAge: SESSION_COOKIE_CACHE_SECONDS,
      strategy: "compact",
    },
    expiresIn: SESSION_TTL_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
    freshAge: 0,
    storeSessionInDatabase: Boolean(betterAuthSecondaryStorage),
  },
  account: {
    modelName: "Account",
    accountLinking: authCredentialPolicy.accountLinking,
  },
  verification: {
    modelName: "Verification",
    storeInDatabase: Boolean(betterAuthSecondaryStorage),
  },
  socialProviders: {
    ...(githubCredentials
      ? {
          github: {
            clientId: githubCredentials.clientId,
            clientSecret: githubCredentials.clientSecret,
            mapProfileToUser: async (profile: GitHubOAuthProfile) => ({
              name: getOAuthDisplayName(profile.name, profile.login),
              username: await getAvailableOAuthUsername("github", String(profile.id), [
                profile.login,
                getEmailLocalPart(profile.email),
                profile.name,
              ]),
            }),
          },
        }
      : {}),
    ...(googleCredentials
      ? {
          google: {
            clientId: googleCredentials.clientId,
            clientSecret: googleCredentials.clientSecret,
            prompt: "select_account",
            mapProfileToUser: async (profile: GoogleOAuthProfile) => ({
              name: getOAuthDisplayName(profile.name, getEmailLocalPart(profile.email)),
              username: await getAvailableOAuthUsername("google", profile.sub, [
                getEmailLocalPart(profile.email),
                profile.name,
              ]),
            }),
          },
        }
      : {}),
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

type UserEmailVerification = {
  emailVerified?: boolean | null;
  emailVerifiedAt?: Date | null;
};

export type { AuthSessionUser, SessionLookupOptions };
export type AuthSessionIdentity = BaseAuthSessionIdentity<BetterAuthSessionData["session"]>;
export type AuthContext = BaseAuthContext<BetterAuthSessionData["session"]>;

const sessionAccessors = createAuthSessionAccessors<BetterAuthSessionData>({
  findUserById: (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
    }),
  getHeaders: headers,
  getSession: (params) => auth.api.getSession(params),
});

export const getCurrentSessionIdentity = sessionAccessors.getCurrentSessionIdentity;
export const getCurrentSession = sessionAccessors.getCurrentSession;

export async function hasCredentialPassword(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: {
      password: { not: null },
      providerId: "credential",
      userId,
    },
    select: { id: true },
  });

  return Boolean(account);
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
  const emailVerification = user as User & UserEmailVerification;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    emailVerified: emailVerification.emailVerified ?? Boolean(emailVerification.emailVerifiedAt),
  };
}
