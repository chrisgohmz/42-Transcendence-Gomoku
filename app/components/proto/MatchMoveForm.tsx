"use client";

import type { ChangeEventHandler, SubmitEventHandler } from "react";
import { useState } from "react";

export type SubmittedMoveInfo = {
  accepted: boolean;
  requestId: string | null;
  position: { x: number; y: number };
};

type MatchMoveFormProps = {
  matchId: string;
  participantId: string;
  baseVersion?: number | null;
  onSuccess: (submittedMove: SubmittedMoveInfo) => void;
  onError: (message: string) => void;
};

type SubmitMoveResponse = {
  ok?: boolean;
  accepted?: boolean;
  requestId?: string | null;
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

export function MatchMoveForm({
  matchId,
  participantId,
  baseVersion,
  onSuccess,
  onError,
}: MatchMoveFormProps) {
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [isLoading, setIsLoading] = useState(false);

  const handleXChange: ChangeEventHandler<HTMLInputElement> = (changeEvent) => {
    setX(changeEvent.currentTarget.value);
  };

  const handleYChange: ChangeEventHandler<HTMLInputElement> = (changeEvent) => {
    setY(changeEvent.currentTarget.value);
  };

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (submitEvent) => {
    submitEvent.preventDefault();

    const parsedX = Number.parseInt(x, 10);
    const parsedY = Number.parseInt(y, 10);

    if (!Number.isInteger(parsedX) || !Number.isInteger(parsedY)) {
      onError("x and y must be integers");
      return;
    }

    setIsLoading(true);

    try {
      const requestId = crypto.randomUUID();
      const response = await fetch(`/api/matches/${matchId}/moves`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId,
          position: { x: parsedX, y: parsedY },
          requestId,
          baseVersion,
        }),
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

      const result = (await response.json()) as SubmitMoveResponse;

      onSuccess({
        accepted: result.accepted === true,
        requestId: result.requestId ?? requestId,
        position: { x: parsedX, y: parsedY },
      });
    } catch {
      onError("Network error while submitting move");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        x:
        <input type="number" value={x} onChange={handleXChange} disabled={isLoading} />
      </label>
      <label>
        y:
        <input type="number" value={y} onChange={handleYChange} disabled={isLoading} />
      </label>
      <button type="submit" className="btn" disabled={isLoading}>
        {isLoading ? "Submitting..." : "Submit Move"}
      </button>
    </form>
  );
}
