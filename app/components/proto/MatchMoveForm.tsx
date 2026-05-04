"use client";

import type { ChangeEventHandler, SubmitEventHandler } from "react";
import { useState } from "react";

import { submitMove, type SubmittedMoveInfo } from "./submit-move";

export type { SubmittedMoveInfo } from "./submit-move";

type MatchMoveFormProps = {
  matchId: string;
  participantId: string;
  baseVersion?: number | null;
  onSuccess: (submittedMove: SubmittedMoveInfo) => void;
  onError: (message: string) => void;
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
      const submittedMove = await submitMove({
        matchId,
        participantId,
        position: { x: parsedX, y: parsedY },
        baseVersion,
      });
      onSuccess(submittedMove);
    } catch (submitError) {
      onError(
        submitError instanceof Error ? submitError.message : "Network error while submitting move",
      );
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
