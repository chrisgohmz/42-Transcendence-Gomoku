import {
  internalRealtimeSecretHeader,
  isChallengeReceivedPayload,
  readRealtimeInternalSecret,
} from "../../shared/realtime-internal";

type ChallengeReceivedEmitter = {
  emit(
    event: "challenge:receive",
    payload: {
      declineToken: string;
      matchId: string;
      password: string;
      senderUsername: string;
    },
  ): void;
};

type ChallengeReceivedServer = {
  to(room: string): ChallengeReceivedEmitter;
};

export async function handleInternalChallengeReceived(
  request: Request,
  io: ChallengeReceivedServer,
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

  if (!isChallengeReceivedPayload(payload)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const room = `user:${payload.username}`;

  io.to(room).emit("challenge:receive", {
    declineToken: payload.declineToken,
    matchId: payload.matchId,
    password: payload.password,
    senderUsername: payload.senderUsername,
  });
  logger.log(`[realtime] broadcast challenge:receive to ${room}`);

  return Response.json({ ok: true, room });
}
