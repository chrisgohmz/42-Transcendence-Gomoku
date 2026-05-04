import type { Socket } from "socket.io";

import { isMatchSubscribePayload } from "../../shared/match-events-validation";
import { matchRoomId } from "../lib/rooms";

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
