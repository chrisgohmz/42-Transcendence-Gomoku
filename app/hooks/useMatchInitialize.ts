"use client";

import { useEffect, useState } from "react";

import type { StoredMatchSession } from "@/lib/proto/match-session-storage";
import {
  clearStoredMatchSession,
  readActiveStoredMatchSession,
} from "@/lib/proto/match-session-storage";
import type { MatchStateResponse } from "@/lib/proto/match-state";

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

      const storedSession = readActiveStoredMatchSession();
      if (!storedSession) {
        if (active) setIsLoading(false);
        return;
      }

      try {
        const searchParams = new URLSearchParams({
          participantId: storedSession.participantId,
        });
        const response = await fetch(
          `/api/matches/${encodeURIComponent(storedSession.matchId)}/state?${searchParams}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          if (response.status === 403 || response.status === 404) {
            clearStoredMatchSession(storedSession.matchId);
          }

          if (active) {
            setSession(null);
            setState(null);
            setError(response.status === 403 ? "missing_participant" : "failed_to_load_state");
          }
          return;
        }

        const data = (await response.json()) as MatchStateResponse;

        const participant = data.participants.find(
          (item) => item.participantId === storedSession.participantId,
        );

        if (!participant) {
          clearStoredMatchSession(storedSession.matchId);

          if (active) {
            setSession(null);
            setState(null);
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
