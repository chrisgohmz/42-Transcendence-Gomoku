"use client";

import { useState } from "react";

type RoomCreateButtonProps = {
  onSuccess: (roomId: string) => void;
  onError: (message: string) => void;
};

type CreateRoomResponse = {
  id?: string;
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

export function RoomCreateButton({
  onSuccess,
  onError,
}: RoomCreateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorPayload = (await response
          .json()
          .catch(() => null)) as ErrorResponse | null;
        const message =
          errorPayload?.message ??
          errorPayload?.detail ??
          errorPayload?.error ??
          `Request failed with status ${response.status}`;
        onError(message);
        return;
      }

      const result = (await response.json()) as CreateRoomResponse;
      const roomId = result.id;

      if (!roomId) {
        onError("Invalid response: id is missing");
        return;
      }

      onSuccess(roomId);
    } catch {
      onError("Network error while creating room");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? "Creating..." : "Create Room"}
    </button>
  );
}
