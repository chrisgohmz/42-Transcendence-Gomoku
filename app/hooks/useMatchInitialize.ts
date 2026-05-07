"use client";

import { useEffect, useState } from "react";

import type { Cell, Seat } from "../../shared/match-events";

export type StoredMatchSession = {
  matchId: string;
  participantId: string;
  role: "PLAYER" | "SPECTATOR";
  seat: "BLACK" | "WHITE" | null;
  displayName: string;
};

export type MatchStateResponse = {
  matchId: string;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  visibility: "PUBLIC" | "PRIVATE";
  boardSize: number;
  stateVersion: number;
  nextTurnSeat: Seat | null;
  winningSeat: Seat | null;
  endReason: string | null;
  createdByUserId: string | null;
  participants: Array<{
    participantId: string;
    userId: string | null;
    displayName: string;
    role: "PLAYER" | "SPECTATOR";
    seat: Seat | null;
    joinedAt: string;
    leftAt: string | null;
  }>;
  moves: Array<{
    moveNumber: number;
    participantId: string;
    position: { x: number; y: number };
    requestId: string | null;
    baseVersion: number | null;
    stateVersion: number;
  }>;
  board: Cell[][];
};

const STORAGE_PREFIX = "proto:matchSession:";

function readStoredSession(): StoredMatchSession | null {
  for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith(STORAGE_PREFIX)) continue;

    const raw = sessionStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as StoredMatchSession;
      if (parsed.matchId && parsed.participantId) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function useMatchInitialize() {
  const [session, setSession] = useState<StoredMatchSession | null>(null);
  const [state, setState] = useState<MatchStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setIsLoading(true);
      setError(null);

      const storedSession = readStoredSession();
      if (!storedSession) {
        if (active) setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/matches/${storedSession.matchId}/state`, {
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 404) {
            sessionStorage.removeItem(`${STORAGE_PREFIX}${storedSession.matchId}`);
          }

          if (active) {
            setSession(null);
            setState(null);
            setError("failed_to_load_state");
          }
          return;
        }

        const data = (await response.json()) as MatchStateResponse;

        const participant = data.participants.find(
          (item) => item.participantId === storedSession.participantId,
        );

        if (!participant) {
          if (active) {
            setSession(null);
            setState(data);
            setError("missing_participant");
          }
          return;
        }

        if (active) {
          setSession(storedSession);
          setState(data);
        }
      } catch {
        if (active) {
          setSession(null);
          setState(null);
          setError("network_error");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  return { session, state, isLoading, error, setSession };
}
