"use client";
import { useState } from "react";

export type JoinedMatchInfo = {
  matchId: string;
  participantId: string;
  role?: string;
  seat?: string | null;
};

type MatchJoinButtonProps = {
  matchId: string;
  displayName: string;
  onSuccess: (joinedMatch: JoinedMatchInfo) => void;
  onError: (message: string) => void;
};

type JoinMatchResponse = {
  matchId?: string;
  participantId?: string;
  role?: string;
  seat?: string | null;
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

export function MatchJoinButton({
  matchId,
  displayName,
  onSuccess,
  onError,
}: MatchJoinButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        const message =
          errorPayload?.message ??
          errorPayload?.detail ??
          errorPayload?.error ??
          `Request failed with status ${response.status}`;
        onError(message);
        return;
      }

      const result = (await response.json()) as JoinMatchResponse;

      const participantId = result.participantId;

      if (!participantId) {
        onError("Invalid response: participantId is missing");
        return;
      }

      onSuccess({
        matchId: result.matchId ?? matchId,
        participantId,
        role: result.role,
        seat: result.seat,
      });
    } catch {
      onError("Network error while joining match");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn"
      onClick={handleClick}
      disabled={isLoading || !displayName}
    >
      {isLoading ? "Joining..." : "Join Match"}
    </button>
  );
}
