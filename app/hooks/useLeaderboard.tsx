"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: string;
};

type LeaderboardSnapshot = {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
};

export function useLeaderboard(initial?: LeaderboardSnapshot | null, debounceMs = 800) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial?.entries ?? []);
  const [currentUser, setCurrentUser] = useState<LeaderboardEntry | null>(
    initial?.currentUser ?? null,
  );
  const [loading, setLoading] = useState<boolean>(!initial);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSnapshot = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leaderboard", { signal });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body: LeaderboardSnapshot = await res.json();
      setEntries(body.entries ?? []);
      setCurrentUser(body.currentUser ?? null);
    } catch (err: unknown) {
      if ((err as any)?.name === "AbortError") return;
      setError((err as Error)?.message ?? "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDebounced = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setTimeout(() => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      void fetchSnapshot(abortRef.current.signal);
      timerRef.current = null;
    }, debounceMs);
  }, [fetchSnapshot, debounceMs]);

  useEffect(() => {
    // initial fetch if no initial snapshot provided
    if (!initial) {
      abortRef.current = new AbortController();
      void fetchSnapshot(abortRef.current.signal);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    entries,
    currentUser,
    loading,
    error,
    refreshDebounced,
    refresh: () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      void fetchSnapshot(abortRef.current.signal);
    },
  } as const;
}
