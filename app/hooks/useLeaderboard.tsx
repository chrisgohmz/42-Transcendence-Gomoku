"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import type { LeaderboardEntry, LeaderboardScope, LeaderboardSnapshot } from "@/lib/leaderboard";

export function getLeaderboardApiPath(scope: LeaderboardScope): string {
  if (scope === "friends") {
    return "/api/leaderboard?scope=friends";
  }

  return "/api/leaderboard";
}

export function useLeaderboard(
  initial?: LeaderboardSnapshot | null,
  scope: LeaderboardScope = "all",
  queryString = "",
  debounceMs = 800,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial?.entries ?? []);
  const [currentUser, setCurrentUser] = useState<LeaderboardEntry | null>(
    initial?.currentUser ?? null,
  );
  const [loading, setLoading] = useState<boolean>(!initial);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setEntries(initial?.entries ?? []);
    setCurrentUser(initial?.currentUser ?? null);
    setLoading(!initial);
    setError(null);
  }, [initial, scope, queryString]);

  const fetchSnapshot = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const fallbackPath = getLeaderboardApiPath(scope);
        const res = await fetch(queryString ? `/api/leaderboard?${queryString}` : fallbackPath, {
          signal,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body: LeaderboardSnapshot = await res.json();
        setEntries(body.entries ?? []);
        setCurrentUser(body.currentUser ?? null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError((err as Error)?.message ?? "unknown");
      } finally {
        setLoading(false);
      }
    },
    [queryString, scope],
  );

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
  }, [fetchSnapshot, initial]);

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
