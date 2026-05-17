import {
  internalRealtimeSecretHeader,
  isChallengeDeclinedPayload,
  readRealtimeInternalSecret,
} from "../../shared/realtime-internal";

type ChallengeDeclinedEmitter = {
  emit(event: "challenge:declined", payload: { matchId: string; senderUsername: string }): void;
};

type ChallengeDeclinedServer = {
  to(room: string): ChallengeDeclinedEmitter;
};

export async function handleInternalChallengeDeclined(
  request: Request,
  io: ChallengeDeclinedServer,
  internalSecret = readRealtimeInternalSecret(),
  logger: Pick<Console, "log"> = console,
) {
  if (!internalSecret) {
    return Response.json({ error: "internal_secret_unconfigured" }, { status: 503 });
  }

  if (request.headers.get(internalRealtimeSecretHeader) !== internalSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!isChallengeDeclinedPayload(payload)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const room = `user:${payload.username}`;

  io.to(room).emit("challenge:declined", {
    matchId: payload.matchId,
    senderUsername: payload.senderUsername,
  });
  logger.log(`[realtime] broadcast challenge:declined to ${room}`);

  return Response.json({ ok: true, room });
}
