import type { GameUpdatePayload } from "../../shared/match-events";
import { isGameUpdatePayload } from "../../shared/match-events-validation";
import {
  internalRealtimeSecretHeader,
  readRealtimeInternalSecret,
} from "../../shared/realtime-internal";
import { matchRoomId } from "./rooms";

type RoomEmitter = {
  emit(event: "game:update", payload: GameUpdatePayload): void;
};

type GameUpdateServer = {
  to(room: string): RoomEmitter;
};

type GameUpdateLogger = Pick<Console, "log">;

function getUnauthorizedResponse() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function handleInternalGameUpdate(
  request: Request,
  io: GameUpdateServer,
  internalSecret = readRealtimeInternalSecret(),
  logger: GameUpdateLogger = console,
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

  if (!isGameUpdatePayload(payload)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const room = matchRoomId(payload.matchId);

  io.to(room).emit("game:update", payload);
  logger.log(`[realtime] broadcast game:update to ${room}`);

  return Response.json({
    ok: true,
    room,
  });
}
