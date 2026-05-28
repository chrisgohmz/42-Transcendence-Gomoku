"use client";

import { Swords, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { usePresence } from "@/components/presence-provider";
import {
  clearStoredMatchSession,
  notifyStoredMatchSessionCleared,
  notifyStoredMatchSessionReady,
  saveStoredMatchSession,
  type StoredMatchSession,
} from "@/lib/matches/match-session-storage";

import type { Seat } from "../../shared/match-events";

type IncomingChallenge = {
  declineToken?: string;
  senderUsername: string;
  matchId: string;
  password?: string;
};

type ChallengeJoinResponse = {
  displayName?: string;
  matchId?: string;
  participantId?: string;
  role?: string;
  seat?: Seat | null;
};

function getStoredRole(role: string | undefined): StoredMatchSession["role"] {
  return role === "SPECTATOR" ? "SPECTATOR" : "PLAYER";
}

export function ChallengeListener() {
  const { socket } = usePresence();
  const router = useRouter();
  const t = useTranslations("human.challenge");

  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [declinedBy, setDeclinedBy] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleReceive = (data: IncomingChallenge) => {
      setIncoming(data);
    };

    const handleDeclined = (data: { matchId?: string; senderUsername: string }) => {
      setDeclinedBy(data.senderUsername);
      if (data.matchId) {
        clearStoredMatchSession(data.matchId);
        notifyStoredMatchSessionCleared(data.matchId);
      }
      setTimeout(() => setDeclinedBy(null), 5000);
    };

    socket.on("challenge:receive", handleReceive);
    socket.on("challenge:declined", handleDeclined);

    return () => {
      socket.off("challenge:receive", handleReceive);
      socket.off("challenge:declined", handleDeclined);
    };
  }, [socket]);

  const handleAccept = async () => {
    if (!incoming) return;
    setIsJoining(true);

    try {
      const res = await fetch(`/api/matches/${incoming.matchId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: incoming.password }),
      });

      if (res.ok) {
        const session = (await res.json()) as ChallengeJoinResponse;
        if (!session.matchId || !session.participantId) {
          setIncoming(null);
          return;
        }

        const storedSession: StoredMatchSession = {
          displayName: session.displayName ?? t("defaultDisplayName"),
          matchId: session.matchId,
          participantId: session.participantId,
          role: getStoredRole(session.role),
          seat: session.seat ?? null,
        };

        saveStoredMatchSession(storedSession);
        notifyStoredMatchSessionReady(storedSession);
        setIncoming(null);
        router.push("/human");
      } else {
        setIncoming(null);
      }
    } catch {
      setIncoming(null);
    } finally {
      setIsJoining(false);
    }
  };

  const handleDecline = async () => {
    if (!incoming) return;
    await fetch(`/api/matches/${encodeURIComponent(incoming.matchId)}/challenge/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ declineToken: incoming.declineToken }),
    }).catch(() => undefined);
    setIncoming(null);
  };

  return (
    <>
      {/* Toast Notification if your friend declines */}
      {declinedBy && (
        <div className="animate-in slide-in-from-bottom-5 fade-in fixed right-5 bottom-5 z-50 rounded-lg border border-[var(--danger)]/35 bg-[#0e0e11] px-4 py-3 shadow-2xl">
          <p className="text-sm font-bold text-[var(--danger)]">
            {t("declinedToast", { name: declinedBy })}
          </p>
        </div>
      )}

      {/* The Pop-up Modal when someone invites you */}
      {incoming && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm duration-200">
          <dialog
            open
            className="animate-in zoom-in-95 m-0 w-full max-w-sm overflow-hidden rounded-xl border border-[var(--panel-border-soft)] bg-[#0e0e11] p-0 text-left text-inherit shadow-2xl duration-200"
            aria-modal="true"
            aria-labelledby="challenge-dialog-title"
          >
            <div className="flex items-center justify-between border-b border-[var(--panel-border-soft)] bg-[var(--mint)]/10 px-5 py-4">
              <h3
                id="challenge-dialog-title"
                className="flex items-center gap-2 font-black text-[var(--mint)]"
              >
                <Swords aria-hidden="true" className="size-5" />
                {t("title")}
              </h3>
            </div>

            <div className="p-6 text-center">
              <p className="mb-6 text-base leading-relaxed text-[var(--muted-text)]">
                {t.rich("body", {
                  name: incoming.senderUsername,
                  strong: (chunks) => <strong className="text-lg text-white">{chunks}</strong>,
                })}
              </p>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={isJoining}
                  className="flex-1 rounded-md border border-[var(--danger)]/35 px-4 py-2.5 text-sm font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-50"
                >
                  {t("decline")}
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isJoining}
                  className="flex flex-1 items-center justify-center rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)] px-4 py-2.5 text-sm font-black text-[var(--mint)] transition-colors hover:bg-[var(--mint)]/20 disabled:opacity-50"
                >
                  {isJoining ? <Loader2 className="size-4 animate-spin" /> : t("accept")}
                </button>
              </div>
            </div>
          </dialog>
        </div>
      )}
    </>
  );
}
