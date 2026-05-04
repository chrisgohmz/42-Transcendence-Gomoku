export type SubmittedMoveInfo = {
  accepted: boolean;
  requestId: string | null;
  position: { x: number; y: number };
};

type SubmitMoveInput = {
  matchId: string;
  participantId: string;
  position: { x: number; y: number };
  baseVersion?: number | null;
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

export async function submitMove({
  matchId,
  participantId,
  position,
  baseVersion,
}: SubmitMoveInput): Promise<SubmittedMoveInfo> {
  const requestId = crypto.randomUUID();
  let response: Response;

  try {
    response = await fetch(`/api/matches/${matchId}/moves`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participantId,
        position,
        requestId,
        baseVersion,
      }),
    });
  } catch {
    throw new Error("Network error while submitting move");
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
    const message =
      errorPayload?.message ??
      errorPayload?.detail ??
      errorPayload?.error ??
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  const result = (await response.json()) as SubmitMoveResponse;

  return {
    accepted: result.accepted === true,
    requestId: result.requestId ?? requestId,
    position,
  };
}
