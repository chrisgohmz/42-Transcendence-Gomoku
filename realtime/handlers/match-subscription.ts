import type { Socket } from "socket.io";

import type { MatchSubscribePayload } from "../../app/shared/match-events";
import { matchRoomId } from "../lib/rooms";

export function registerMatchSubscription(socket: Socket) {
  socket.on("match:subscribe", async (payload: MatchSubscribePayload) => {
    const { matchId, participantId } = payload;

    if (!matchId || !participantId) {
      socket.emit("error", { reason: "invalid_payload" });
      return;
    }

    const room = matchRoomId(matchId);
    await socket.join(room);

    console.log(`[realtime] ${socket.id} joined room ${room} as ${participantId}`);

    socket.emit("match:subscribed", { matchId });
  });
}
