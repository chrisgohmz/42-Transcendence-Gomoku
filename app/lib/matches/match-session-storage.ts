import type { Seat } from "../../../shared/match-events";
import { isAiDifficultyId, type AiDifficultyId } from "./ai-difficulty";

export type StoredMatchSession = {
  matchId: string;
  participantId: string;
  role: "PLAYER" | "SPECTATOR";
  seat: Seat | null;
  displayName: string;
  aiDifficulty?: AiDifficultyId;
  mode?: "ai" | "human";
};

type StoredMatchSessionRecord = StoredMatchSession & {
  updatedAt: string;
};

type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const STORAGE_PREFIX = "match:session:v1:";
const LEGACY_STORAGE_PREFIX = "proto:matchSession:v1:";
export const activeMatchSessionKey = `${STORAGE_PREFIX}active`;
export const matchSessionReadyEvent = "match:session-ready";
export const matchSessionClearedEvent = "match:session-cleared";

export type MatchSessionReadyEvent = CustomEvent<StoredMatchSession>;
export type MatchSessionClearedEvent = CustomEvent<{ matchId: string }>;

export function getStoredMatchSessionKey(matchId: string) {
  return `${STORAGE_PREFIX}${matchId}`;
}

function getLegacySessionKey(matchId: string) {
  return `${LEGACY_STORAGE_PREFIX}${matchId}`;
}

function isRole(value: unknown): value is StoredMatchSession["role"] {
  return value === "PLAYER" || value === "SPECTATOR";
}

function isSeat(value: unknown): value is Seat | null {
  return value === "BLACK" || value === "WHITE" || value === null;
}

function isMode(value: unknown): value is StoredMatchSession["mode"] {
  return value === "ai" || value === "human";
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
      aiDifficulty: isAiDifficultyId(parsed.aiDifficulty) ? parsed.aiDifficulty : undefined,
      displayName: parsed.displayName,
      matchId: parsed.matchId,
      mode: isMode(parsed.mode) ? parsed.mode : undefined,
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
    return (
      readStoredSession(storage, activeMatchSessionKey, getStoredMatchSessionKey) ??
      readStoredSession(storage, `${LEGACY_STORAGE_PREFIX}active`, getLegacySessionKey)
    );
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
    storage.setItem(getStoredMatchSessionKey(session.matchId), JSON.stringify(record));
    storage.setItem(activeMatchSessionKey, session.matchId);
  } catch {
    // Storage can be unavailable or quota-limited; the live session still works.
  }
}

export function notifyStoredMatchSessionReady(session: StoredMatchSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(matchSessionReadyEvent, { detail: session }));
}

export function clearStoredMatchSession(
  matchId: string,
  storage: SessionStorageLike = sessionStorage,
) {
  try {
    storage.removeItem(getStoredMatchSessionKey(matchId));
    storage.removeItem(getLegacySessionKey(matchId));
    if (storage.getItem(activeMatchSessionKey) === matchId) {
      storage.removeItem(activeMatchSessionKey);
    }
    if (storage.getItem(`${LEGACY_STORAGE_PREFIX}active`) === matchId) {
      storage.removeItem(`${LEGACY_STORAGE_PREFIX}active`);
    }
  } catch {
    // Ignore storage failures; callers already clear in-memory state.
  }
}

export function notifyStoredMatchSessionCleared(matchId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(matchSessionClearedEvent, { detail: { matchId } }));
}

function readStoredSession(
  storage: SessionStorageLike,
  activeKey: string,
  sessionKeyFor: (matchId: string) => string,
): StoredMatchSession | null {
  const activeMatchId = storage.getItem(activeKey);
  if (!activeMatchId) {
    return null;
  }

  const raw = storage.getItem(sessionKeyFor(activeMatchId));
  if (!raw) {
    storage.removeItem(activeKey);
    return null;
  }

  const session = parseStoredMatchSession(raw);
  if (!session || session.matchId !== activeMatchId) {
    storage.removeItem(activeKey);
    return null;
  }

  return session;
}
