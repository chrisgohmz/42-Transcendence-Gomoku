import {
  internalRealtimeSecretHeader,
  isFriendshipUpdatePayload,
  readRealtimeInternalSecret,
} from "../../shared/realtime-internal";

type RoomEmitter = {
  emit(event: string): void;
};

type FriendshipUpdateServer = {
  to(room: string): RoomEmitter;
};

type FriendshipUpdateLogger = Pick<Console, "log">;

function getUnauthorizedResponse() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function handleInternalFriendshipUpdate(
  request: Request,
  io: FriendshipUpdateServer,
  internalSecret = readRealtimeInternalSecret(),
  logger: FriendshipUpdateLogger = console,
) {
  if (!internalSecret) {
    return Response.json({ error: "internal_secret_unconfigured" }, { status: 503 });
  }

  if (request.headers.get(internalRealtimeSecretHeader) !== internalSecret) {
    return getUnauthorizedResponse();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!isFriendshipUpdatePayload(payload)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  for (const username of payload.usernames) {
    io.to(`user:${username}`).emit("friendship:refresh");
    logger.log(`[realtime] broadcast friendship:refresh to user:${username}`);
  }

  return Response.json({ ok: true });
}
