import { beforeEach, describe, expect, test } from "bun:test";

import {
  clearStoredMatchSession,
  parseStoredMatchSession,
  readActiveStoredMatchSession,
  saveStoredMatchSession,
  type StoredMatchSession,
} from "./match-session-storage";

class MemoryStorage implements Pick<Storage, "getItem" | "removeItem" | "setItem"> {
  private readonly items = new Map<string, string>();

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

const blackSession: StoredMatchSession = {
  displayName: "Black",
  matchId: "match-black",
  participantId: "participant-black",
  role: "PLAYER",
  seat: "BLACK",
};

const whiteSession: StoredMatchSession = {
  displayName: "White",
  matchId: "match-white",
  participantId: "participant-white",
  role: "PLAYER",
  seat: "WHITE",
};

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

describe("match session storage", () => {
  test("reads the latest saved active session", () => {
    saveStoredMatchSession(blackSession, storage);
    saveStoredMatchSession(whiteSession, storage);

    expect(readActiveStoredMatchSession(storage)).toEqual(whiteSession);
  });

  test("ignores legacy per-match entries when no active pointer exists", () => {
    storage.setItem("proto:matchSession:legacy-match", JSON.stringify(blackSession));

    expect(readActiveStoredMatchSession(storage)).toBeNull();
  });

  test("clears the active pointer when its match is removed", () => {
    saveStoredMatchSession(blackSession, storage);
    clearStoredMatchSession(blackSession.matchId, storage);

    expect(readActiveStoredMatchSession(storage)).toBeNull();
  });

  test("rejects malformed stored sessions", () => {
    expect(parseStoredMatchSession(JSON.stringify({ matchId: "match-only" }))).toBeNull();
  });
});
