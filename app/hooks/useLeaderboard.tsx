"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import { createSocket } from "@/lib/socket-client";

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
  const socketRef = useRef<any>(null);
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
      fetchSnapshot(abortRef.current.signal);
      timerRef.current = null;
    }, debounceMs);
  }, [fetchSnapshot, debounceMs]);

  useEffect(() => {
    // initial fetch if no initial snapshot provided
    if (!initial) {
      abortRef.current = new AbortController();
      fetchSnapshot(abortRef.current.signal);
    }

    // setup socket listener
    const socket = createSocket();
    socketRef.current = socket;

    const onStatsRefresh = (payload: { userId?: string; reason?: string }) => {
      // If payload contains userId but it's not relevant, we still refresh
      // but you can filter here if you only want refresh for certain users.
      refreshDebounced();
    };

    try {
      socket.on("stats:refresh", onStatsRefresh);
    } catch {
      // socket might not be connected; ignore
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
      if (socketRef.current) {
        try {
          socketRef.current.off("stats:refresh", onStatsRefresh);
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    entries,
    currentUser,
    loading,
    error,
    refresh: () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      fetchSnapshot(abortRef.current.signal);
    },
  } as const;
}
