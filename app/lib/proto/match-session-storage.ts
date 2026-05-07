import type { Seat } from "../../../shared/match-events";

export type StoredMatchSession = {
  matchId: string;
  participantId: string;
  role: "PLAYER" | "SPECTATOR";
  seat: Seat | null;
  displayName: string;
};

type StoredMatchSessionRecord = StoredMatchSession & {
  updatedAt: string;
};

type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const STORAGE_PREFIX = "proto:matchSession:v1:";
const ACTIVE_SESSION_KEY = `${STORAGE_PREFIX}active`;

function getSessionKey(matchId: string) {
  return `${STORAGE_PREFIX}${matchId}`;
}

function isRole(value: unknown): value is StoredMatchSession["role"] {
  return value === "PLAYER" || value === "SPECTATOR";
}

function isSeat(value: unknown): value is Seat | null {
  return value === "BLACK" || value === "WHITE" || value === null;
}

export function parseStoredMatchSession(raw: string): StoredMatchSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMatchSessionRecord>;

    if (
      typeof parsed.matchId !== "string" ||
      parsed.matchId.length === 0 ||
      typeof parsed.participantId !== "string" ||
      parsed.participantId.length === 0 ||
      !isRole(parsed.role) ||
      !isSeat(parsed.seat) ||
      typeof parsed.displayName !== "string"
    ) {
      return null;
    }

    return {
      displayName: parsed.displayName,
      matchId: parsed.matchId,
      participantId: parsed.participantId,
      role: parsed.role,
      seat: parsed.seat,
    };
  } catch {
    return null;
  }
}

export function readActiveStoredMatchSession(
  storage: SessionStorageLike = sessionStorage,
): StoredMatchSession | null {
  try {
    const activeMatchId = storage.getItem(ACTIVE_SESSION_KEY);
    if (!activeMatchId) {
      return null;
    }

    const raw = storage.getItem(getSessionKey(activeMatchId));
    if (!raw) {
      storage.removeItem(ACTIVE_SESSION_KEY);
      return null;
    }

    const session = parseStoredMatchSession(raw);
    if (!session || session.matchId !== activeMatchId) {
      storage.removeItem(ACTIVE_SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function saveStoredMatchSession(
  session: StoredMatchSession,
  storage: SessionStorageLike = sessionStorage,
) {
  const record: StoredMatchSessionRecord = {
    ...session,
    updatedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(getSessionKey(session.matchId), JSON.stringify(record));
    storage.setItem(ACTIVE_SESSION_KEY, session.matchId);
  } catch {
    // Storage can be unavailable or quota-limited; the live session still works.
  }
}

export function clearStoredMatchSession(
  matchId: string,
  storage: SessionStorageLike = sessionStorage,
) {
  try {
    storage.removeItem(getSessionKey(matchId));
    if (storage.getItem(ACTIVE_SESSION_KEY) === matchId) {
      storage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    // Ignore storage failures; callers already clear in-memory state.
  }
}
