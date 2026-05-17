"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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
  const humanT = useTranslations("human.defaults");
  const challengeT = useTranslations("human.challenge");
  const [challengingUsername, setChallengingUsername] = useState<string | null>(null);

  const challengePlayer = useCallback(
    async (targetUsername: string) => {
      setChallengingUsername(targetUsername);

      try {
        const response = await fetch("/api/matches/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: challengeT("roomName", { name: targetUsername }),
            targetUsername,
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

        router.push("/human");
        return true;
      } catch (error) {
        console.error("Challenge failed", error);
        return false;
      } finally {
        setChallengingUsername(null);
      }
    },
    [challengeT, humanT, router],
  );

  return {
    challengePlayer,
    challengingUsername,
    isChallenging: challengingUsername !== null,
  };
}
