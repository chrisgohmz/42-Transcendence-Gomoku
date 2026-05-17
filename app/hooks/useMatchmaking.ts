"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { Socket } from "socket.io-client";

import type { StoredMatchSession } from "@/lib/matches/match-session-storage";
import { createSocket } from "@/lib/socket-client";

type QueueStatus = "idle" | "queued" | "matched";

let socketInstance: Socket | null = null;
function getSocket() {
  if (!socketInstance) {
    socketInstance = createSocket();
  }
  return socketInstance;
}

export function useMatchmaking({
  onMatchFound,
}: {
  onMatchFound?: (session: StoredMatchSession) => void;
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
    const socket = getSocket();

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
  }, [onMatchFound]);

  const joinQueue = useCallback(() => {
    setError(null);
    setStatus("queued");
    getSocket().emit("queue:join");
  }, []);

  const leaveQueue = useCallback(() => {
    getSocket().emit("queue:leave");
    setStatus("idle");
    setPosition(null);
    queuedSessionRef.current = null;
  }, []);

  return { status, position, error, joinQueue, leaveQueue, globalStats };
}
