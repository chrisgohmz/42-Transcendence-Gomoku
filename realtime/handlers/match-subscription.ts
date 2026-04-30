import type { Socket } from "socket.io";

import type { MatchSubscribePayload } from "../../shared/match-events";
import { matchRoomId } from "../lib/rooms";

function isMatchSubscribePayload(payload: unknown): payload is MatchSubscribePayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const { matchId, participantId } = payload as Partial<MatchSubscribePayload>;

  return (
    typeof matchId === "string" &&
    matchId.length > 0 &&
    typeof participantId === "string" &&
    participantId.length > 0
  );
}

export function registerMatchSubscription(socket: Socket) {
  socket.on("match:subscribe", async (payload: unknown) => {
    if (!isMatchSubscribePayload(payload)) {
      socket.emit("error", { reason: "invalid_payload" });
      return;
    }

    const { matchId, participantId } = payload;

    const room = matchRoomId(matchId);
    await socket.join(room);

    console.log(`[realtime] ${socket.id} joined room ${room} as ${participantId}`);

    socket.emit("match:subscribed", { matchId });
  });
}
