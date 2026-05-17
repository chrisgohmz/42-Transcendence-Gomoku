"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { LobbyEntry } from "@/components/game-lobby-table";
import {
  saveStoredMatchSession,
  type StoredMatchSession,
} from "@/lib/matches/match-session-storage";

import type { Seat } from "../../shared/match-events";

type MatchParticipant = {
  displayName: string;
  seat: Seat | null;
};

type Match = {
  matchId: string;
  name?: string | null;
  requiresPassword?: boolean;
  status?: string;
  boardSize?: number;
  participants?: MatchParticipant[];
};

type MatchActionResponse = {
  matchId?: string;
  participantId?: string;
  role?: string;
  seat?: Seat | null;
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

export type CreateRoomOptions = {
  name?: string;
  password?: string;
  visibility?: "PUBLIC" | "PRIVATE";
};

function getErrorMessage(payload: ErrorResponse | null, fallback: string) {
  return payload?.message ?? payload?.detail ?? payload?.error ?? fallback;
}

function getStoredRole(role: string | undefined): StoredMatchSession["role"] {
  return role === "SPECTATOR" ? "SPECTATOR" : "PLAYER";
}

function saveMatchSession(
  session: MatchActionResponse,
  defaultPlayerName: string,
): StoredMatchSession | null {
  if (!session.matchId || !session.participantId) {
    return null;
  }

  const storedSession: StoredMatchSession = {
    displayName: defaultPlayerName,
    matchId: session.matchId,
    participantId: session.participantId,
    role: getStoredRole(session.role),
    seat: session.seat ?? null,
  };

  saveStoredMatchSession(storedSession);
  return storedSession;
}

function mapMatchToEntry(match: Match, defaultPlayerName: string): LobbyEntry {
  const hostName = match.participants?.[0]?.displayName ?? defaultPlayerName;

  return {
    matchId: match.matchId,
    name: match.name,
    player: hostName,
    playerCount: match.participants?.length ?? 0,
    requiresPassword: match.requiresPassword ?? false,
    status: match.status,
    boardSize: match.boardSize,
  };
}

export function useHumanLobby({
  onSessionReady,
}: {
  onSessionReady?: (session: StoredMatchSession) => void;
} = {}) {
  const humanT = useTranslations("human");
  const createT = useTranslations("human.createRoom");
  const joinT = useTranslations("human.join");
  const defaultPlayerName = humanT("defaults.playerName");

  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setIsLoadingMatches(true);

    try {
      const response = await fetch("/api/matches", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        setListError(
          getErrorMessage(errorPayload, humanT("requestFailed", { status: response.status })),
        );
        setMatches([]);
        return;
      }

      const data = (await response.json()) as Match[];
      setMatches(data);
      setListError(null);
      setJoinError(null);
    } catch (error) {
      console.error("Error loading matches:", error);
      setListError(error instanceof Error ? error.message : humanT("networkLoadError"));
      setMatches([]);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [humanT]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const createRoom = useCallback(
    async (options?: CreateRoomOptions) => {
      setIsCreating(true);
      setCreateError(null);

      try {
        const visibility = options?.visibility ?? "PUBLIC";
        const response = await fetch("/api/matches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: options?.name,
            ...(visibility === "PRIVATE" && options?.password
              ? { password: options.password }
              : {}),
            visibility,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            setCreateError(createT("signInRequired"));
            return;
          }

          const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
          setCreateError(
            getErrorMessage(errorPayload, humanT("requestFailed", { status: response.status })),
          );
          return;
        }

        const result = (await response.json()) as MatchActionResponse;

        if (!result.matchId) {
          setCreateError(createT("missingMatchId"));
          return;
        }

        if (!result.participantId) {
          setCreateError(createT("missingParticipantId"));
          return;
        }

        const storedSession = saveMatchSession(result, defaultPlayerName);
        if (storedSession) {
          onSessionReady?.(storedSession);
        }
        setJoinError(null);
      } catch {
        setCreateError(createT("networkError"));
      } finally {
        setIsCreating(false);
      }
    },
    [createT, defaultPlayerName, humanT, onSessionReady],
  );

  const joinMatch = useCallback(
    async (entry: LobbyEntry, password?: string) => {
      if (!entry.matchId) {
        return;
      }

      setJoiningMatchId(entry.matchId);
      setJoinError(null);

      try {
        const response = await fetch(`/api/matches/${encodeURIComponent(entry.matchId)}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
          setJoinError(
            getErrorMessage(errorPayload, humanT("requestFailed", { status: response.status })),
          );
          return;
        }

        const result = (await response.json()) as MatchActionResponse;

        if (!result.participantId) {
          setJoinError(joinT("missingParticipantId"));
          return;
        }

        const storedSession = saveMatchSession(
          {
            ...result,
            matchId: result.matchId ?? entry.matchId,
          },
          defaultPlayerName,
        );
        if (storedSession) {
          onSessionReady?.(storedSession);
        }
        setCreateError(null);
      } catch {
        setJoinError(joinT("networkError"));
      } finally {
        setJoiningMatchId(null);
      }
    },
    [defaultPlayerName, humanT, joinT, onSessionReady],
  );

  return {
    createError,
    createRoom,
    createSubmitLabel: isCreating ? createT("submitting") : undefined,
    entries: matches.map((match) => mapMatchToEntry(match, defaultPlayerName)),
    isCreating,
    isLoadingMatches,
    joinMatch,
    joiningMatchId,
    loadMatches,
    tableError: listError ?? joinError,
  };
}
