"use client";

import { useCallback, useEffect, useState } from "react";
import { createSocket } from "@/lib/socket-client";
import type { StoredMatchSession } from "@/lib/matches/match-session-storage";
import type { Socket } from "socket.io-client";

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

  useEffect(() => {
    const socket = getSocket();

    const handleStatus = (data: any) => {
      if (data.kind === "queued") {
        setStatus("queued");
        setPosition(data.queuePosition);
      } else if (data.kind === "matched") {
        setStatus("matched");
      }
    };

    const handleMatched = (session: any) => {
      setStatus("matched");
      if (onMatchFound) {
        const storedSession: StoredMatchSession = {
          matchId: session.matchId,
          participantId: session.participantId,
          role: session.role === "SPECTATOR" ? "SPECTATOR" : "PLAYER",
          seat: session.seat,
          displayName: "Player",
        };
        onMatchFound(storedSession);
      }
    };

    const handleError = (err: any) => {
      setError(err.error || "An error occurred");
      setStatus("idle");
    };

    const handleStatsUpdate = (newStats: any) => {
      setGlobalStats(newStats);
    };

    socket.on("queue:status", handleStatus);
    socket.on("queue:matched", handleMatched);
    socket.on("queue:error", handleError);
    socket.on("stats:update", handleStatsUpdate);

    socket.emit("stats:request");

    return () => {
      socket.off("queue:status", handleStatus);
      socket.off("queue:matched", handleMatched);
      socket.off("queue:error", handleError);
      socket.off("stats:update", handleStatsUpdate);
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
  }, []);

  return { status, position, error, joinQueue, leaveQueue, globalStats };
}