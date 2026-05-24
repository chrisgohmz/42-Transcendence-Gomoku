import type { User } from "../../generated/prisma/client";

export type SessionLookupOptions = {
  disableCookieCache?: boolean;
};

type BetterAuthSessionUser = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  id: string;
  image?: string | null;
  name?: string | null;
  username?: string | null;
};

type BetterAuthSessionData = {
  session: unknown;
  user: BetterAuthSessionUser;
};

type GetSessionParams = {
  headers: Headers;
  query?: {
    disableCookieCache: true;
  };
};

type AuthSessionAccessDependencies<SessionData extends BetterAuthSessionData> = {
  findUserById: (userId: string) => Promise<User | null>;
  getHeaders: () => Promise<Headers>;
  getSession: (params: GetSessionParams) => Promise<SessionData | null>;
};

export type AuthSessionUser = Pick<
  User,
  "avatarUrl" | "displayName" | "email" | "emailVerified" | "id" | "username"
>;

export type AuthSessionIdentity<Session> = {
  session: Session;
  user: AuthSessionUser;
};

export type AuthContext<Session> = {
  session: Session;
  user: User;
};

function getSessionDisplayName(user: BetterAuthSessionUser): string {
  return user.displayName ?? user.name ?? user.username ?? "Gomoku Player";
}

function getSessionUsername(user: BetterAuthSessionUser): string {
  return user.username ?? user.id;
}

export function toAuthSessionUser(user: BetterAuthSessionUser): AuthSessionUser {
  return {
    avatarUrl: user.avatarUrl ?? user.image ?? null,
    displayName: getSessionDisplayName(user),
    email: user.email ?? null,
    emailVerified: Boolean(user.emailVerified),
    id: user.id,
    username: getSessionUsername(user),
  };
}

export function createAuthSessionAccessors<SessionData extends BetterAuthSessionData>({
  findUserById,
  getHeaders,
  getSession,
}: AuthSessionAccessDependencies<SessionData>) {
  async function getBetterAuthSession(options: SessionLookupOptions = {}) {
    const query = options.disableCookieCache ? { disableCookieCache: true as const } : undefined;

    return getSession({
      headers: await getHeaders(),
      ...(query ? { query } : {}),
    });
  }

  async function getCurrentSessionIdentity(
    options: SessionLookupOptions = {},
  ): Promise<AuthSessionIdentity<SessionData["session"]> | null> {
    const sessionData = await getBetterAuthSession(options);

    if (!sessionData) {
      return null;
    }

    return {
      session: sessionData.session,
      user: toAuthSessionUser(sessionData.user),
    };
  }

  async function getCurrentSession(
    options: SessionLookupOptions = {},
  ): Promise<AuthContext<SessionData["session"]> | null> {
    const sessionData = await getBetterAuthSession(options);

    if (!sessionData) {
      return null;
    }

    const user = await findUserById(sessionData.user.id);

    if (!user) {
      return null;
    }

    return { session: sessionData.session, user };
  }

  return {
    getCurrentSession,
    getCurrentSessionIdentity,
  };
}
