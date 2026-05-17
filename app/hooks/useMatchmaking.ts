"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import type { StoredMatchSession } from "@/lib/matches/match-session-storage";

type QueueStatus = "idle" | "queued" | "matched";

export function useMatchmaking({
  onMatchFound,
  socket,
}: {
  onMatchFound?: (session: StoredMatchSession) => void;
  socket: Socket | null;
}) {
  const [status, setStatus] = useState<QueueStatus>("idle");
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState({ searching: 0, liveGames: 0 });
  const statusRef = useRef<QueueStatus>("idle");
  const queuedSessionRef = useRef<StoredMatchSession | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!socket) {
      setPosition(null);
      setStatus("idle");
      queuedSessionRef.current = null;
      return;
    }

    const handleStatus = (data: any) => {
      if (data.kind === "queued") {
        setStatus("queued");
        setPosition(data.queuePosition);

        const session: StoredMatchSession = {
          matchId: data.session.matchId,
          participantId: data.session.participantId,
          role: data.session.role === "SPECTATOR" ? "SPECTATOR" : "PLAYER",
          seat: data.session.seat,
          displayName: data.session.displayName || "Player",
        };
        queuedSessionRef.current = session;

        socket.emit("match:subscribe", {
          matchId: session.matchId,
          participantId: session.participantId,
        });
      } else if (data.kind === "matched") {
        setStatus("matched");
        queuedSessionRef.current = null;
      }
    };

    const handleMatched = (session: any) => {
      setStatus("matched");
      queuedSessionRef.current = null;
      if (onMatchFound) {
        const storedSession: StoredMatchSession = {
          matchId: session.matchId,
          participantId: session.participantId,
          role: session.role === "SPECTATOR" ? "SPECTATOR" : "PLAYER",
          seat: session.seat,
          displayName: session.displayName || "Player",
        };
        onMatchFound(storedSession);
      }
    };

    const handleGameUpdate = (payload: any) => {
      const qSession = queuedSessionRef.current;

      if (statusRef.current === "queued" && qSession && payload.matchId === qSession.matchId) {
        if (payload.status === "IN_PROGRESS") {
          setStatus("matched");
          queuedSessionRef.current = null;
          if (onMatchFound) {
            onMatchFound(qSession);
          }
        }
      }
    };

    const handleError = (err: any) => {
      setError(err.error || "An error occurred");
      setStatus("idle");
      queuedSessionRef.current = null;
    };

    const handleStatsUpdate = (newStats: any) => {
      setGlobalStats(newStats);
    };

    socket.on("queue:status", handleStatus);
    socket.on("queue:matched", handleMatched);
    socket.on("queue:error", handleError);
    socket.on("stats:update", handleStatsUpdate);
    socket.on("game:update", handleGameUpdate);
    socket.emit("stats:request");

    return () => {
      socket.off("queue:status", handleStatus);
      socket.off("queue:matched", handleMatched);
      socket.off("queue:error", handleError);
      socket.off("stats:update", handleStatsUpdate);
      socket.off("game:update", handleGameUpdate);
    };
  }, [onMatchFound, socket]);

  const joinQueue = useCallback(() => {
    if (!socket) {
      setError("Realtime is not connected");
      setStatus("idle");
      return;
    }

    setError(null);
    setStatus("queued");
    socket.emit("queue:join");
  }, [socket]);

  const leaveQueue = useCallback(() => {
    socket?.emit("queue:leave");
    setStatus("idle");
    setPosition(null);
    queuedSessionRef.current = null;
  }, [socket]);

  return { status, position, error, joinQueue, leaveQueue, globalStats };
}
