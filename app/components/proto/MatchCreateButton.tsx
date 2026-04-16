"use client";

import { useState } from "react";

export type CreatedMatchInfo = {
  matchId: string;
  participantId: string;
  role?: string;
  seat?: string | null;
};

type MatchCreateButtonProps = {
  onSuccess: (createdMatch: CreatedMatchInfo) => void;
  onError: (message: string) => void;
};

type CreateMatchResponse = {
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

export function MatchCreateButton({ onSuccess, onError }: MatchCreateButtonProps) {
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
          onError("Please sign in before creating a match.");
          return;
        }
        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        const message =
          errorPayload?.message ??
          errorPayload?.detail ??
          errorPayload?.error ??
          `Request failed with status ${response.status}`;
        onError(message);
        return;
      }

      const result = (await response.json()) as CreateMatchResponse;
      const matchId = result.matchId;
      const participantId = result.participantId;

      if (!matchId) {
        onError("Invalid response: matchId is missing");
        return;
      }

      if (!participantId) {
        onError("Invalid response: participantId is missing");
        return;
      }

      onSuccess({
        matchId,
        participantId,
        role: result.role,
        seat: result.seat,
      });
    } catch {
      onError("Network error while creating match");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button type="button" className="btn" onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Creating..." : "Create Match"}
    </button>
  );
}
