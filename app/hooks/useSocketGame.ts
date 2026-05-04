"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type { GameUpdatePayload } from "../../shared/match-events";

type SubscribeStatus = "idle" | "connecting" | "subscribed" | "error";

export function useSocketGame(matchId: string | null, participantId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [lastUpdate, setLastUpdate] = useState<GameUpdatePayload | null>(null);

  useEffect(() => {
    if (!matchId || !participantId) {
      setStatus("idle");
      setLastUpdate(null);
      return;
    }

    setStatus("connecting");
    setLastUpdate(null);

    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    let active = true;

    socket.on("connect", () => {
      socket.emit("match:subscribe", { matchId, participantId });
    });

    socket.on("match:subscribed", () => {
      if (active) setStatus("subscribed");
    });

    socket.on("game:update", (payload: GameUpdatePayload) => {
      if (active) {
        setLastUpdate(payload);
      }
    });

    socket.on("connect_error", () => {
      if (active) setStatus("error");
    });

    socket.on("error", () => {
      if (active) {
        setStatus("error");
      }
    });

    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
      // setStatus("idle");
    };
  }, [matchId, participantId]);

  return { status, lastUpdate, socket: socketRef.current };
}
