"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { usePresence } from "@/components/presence-provider";
import {
  notifyStoredMatchSessionReady,
  saveStoredMatchSession,
  type StoredMatchSession,
} from "@/lib/matches/match-session-storage";

import type { Seat } from "../../shared/match-events";

type ChallengeMatchResponse = {
  displayName?: string;
  matchId?: string;
  participantId?: string;
  role?: string;
  seat?: Seat | null;
};

function getStoredRole(role: string | undefined): StoredMatchSession["role"] {
  return role === "SPECTATOR" ? "SPECTATOR" : "PLAYER";
}

function saveChallengeSession(session: ChallengeMatchResponse, defaultDisplayName: string) {
  if (!session.matchId || !session.participantId) {
    return null;
  }

  const storedSession: StoredMatchSession = {
    displayName: session.displayName ?? defaultDisplayName,
    matchId: session.matchId,
    participantId: session.participantId,
    role: getStoredRole(session.role),
    seat: session.seat ?? null,
  };

  saveStoredMatchSession(storedSession);
  notifyStoredMatchSessionReady(storedSession);

  return storedSession;
}

export function useChallengePlayer() {
  const router = useRouter();
  const { socket } = usePresence();
  const humanT = useTranslations("human.defaults");
  const challengeT = useTranslations("human.challenge");
  const [challengingUsername, setChallengingUsername] = useState<string | null>(null);

  const challengePlayer = useCallback(
    async (targetUsername: string) => {
      if (!socket) {
        return false;
      }

      setChallengingUsername(targetUsername);

      try {
        const password = crypto.randomUUID();

        const response = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: challengeT("roomName", { name: targetUsername }),
            password,
            visibility: "PRIVATE",
          }),
        });

        if (!response.ok) {
          return false;
        }

        const session = (await response.json()) as ChallengeMatchResponse;

        const storedSession = saveChallengeSession(session, humanT("playerName"));
        if (!storedSession || !session.matchId) {
          return false;
        }

        socket.emit("challenge:send", {
          matchId: session.matchId,
          password,
          targetUsername,
        });

        router.push("/human");
        return true;
      } catch (error) {
        console.error("Challenge failed", error);
        return false;
      } finally {
        setChallengingUsername(null);
      }
    },
    [challengeT, humanT, router, socket],
  );

  return {
    challengePlayer,
    challengingUsername,
    isChallenging: challengingUsername !== null,
  };
}
