"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Seat } from "../../../shared/match-events";

export type CreatedMatchInfo = {
  matchId: string;
  participantId: string;
  role?: string;
  seat?: Seat | null;
};

type MatchCreateButtonProps = {
  onSuccess: (createdMatch: CreatedMatchInfo) => void;
  onError: (message: string) => void;
};

type CreateMatchResponse = {
  matchId?: string;
  participantId?: string;
  role?: string;
  seat?: Seat | null;
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

export function MatchCreateButton({ onSuccess, onError }: MatchCreateButtonProps) {
  const t = useTranslations("proto.create");
  const proto = useTranslations("proto");
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (response.status === 401) {
          onError(t("signInRequired"));
          return;
        }
        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        const message =
          errorPayload?.message ??
          errorPayload?.detail ??
          errorPayload?.error ??
          proto("requestFailed", { status: response.status });
        onError(message);
        return;
      }

      const result = (await response.json()) as CreateMatchResponse;
      const matchId = result.matchId;
      const participantId = result.participantId;

      if (!matchId) {
        onError(t("missingMatchId"));
        return;
      }

      if (!participantId) {
        onError(t("missingParticipantId"));
        return;
      }

      onSuccess({
        matchId,
        participantId,
        role: result.role,
        seat: result.seat,
      });
    } catch {
      onError(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button type="button" className="btn" onClick={handleClick} disabled={isLoading}>
      {isLoading ? t("submitting") : t("submit")}
    </button>
  );
}
