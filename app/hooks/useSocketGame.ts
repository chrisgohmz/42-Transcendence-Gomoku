"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { createSocket } from "@/lib/socket-client";

import type { GameUpdatePayload } from "../../shared/match-events";

type SubscribeStatus = "idle" | "connecting" | "subscribed" | "error";

export function useSocketGame(
  matchId: string | null,
  participantId: string | null,
  knownStateVersion: number | null = null,
) {
  const socketRef = useRef<Socket | null>(null);
  const knownStateVersionRef = useRef(knownStateVersion);
  const latestStateVersionRef = useRef(knownStateVersion ?? -1);
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [lastUpdate, setLastUpdate] = useState<GameUpdatePayload | null>(null);

  useEffect(() => {
    knownStateVersionRef.current = knownStateVersion;

    if (typeof knownStateVersion === "number") {
      latestStateVersionRef.current = Math.max(latestStateVersionRef.current, knownStateVersion);
    }
  }, [knownStateVersion]);

  useEffect(() => {
    if (!matchId || !participantId) {
      setStatus("idle");
      setLastUpdate(null);
      latestStateVersionRef.current = -1;
      return;
    }

    setStatus("connecting");
    setLastUpdate(null);
    latestStateVersionRef.current = knownStateVersionRef.current ?? -1;

    const socket = createSocket();
    socketRef.current = socket;

    let active = true;

    socket.on("connect", () => {
      const lastSeenStateVersion = latestStateVersionRef.current;
      socket.emit("match:subscribe", {
        matchId,
        participantId,
        ...(lastSeenStateVersion >= 0 ? { lastSeenStateVersion } : {}),
      });
    });

    socket.on("match:subscribed", () => {
      if (active) setStatus("subscribed");
    });

    socket.on("game:update", (payload: GameUpdatePayload) => {
      if (active && payload.matchId === matchId) {
        if (payload.stateVersion <= latestStateVersionRef.current) {
          return;
        }

        latestStateVersionRef.current = payload.stateVersion;
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

    socket.on("match:error", () => {
      if (active) {
        setStatus("error");
      }
    });

    socket.on("disconnect", () => {
      if (active) {
        setStatus("connecting");
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
