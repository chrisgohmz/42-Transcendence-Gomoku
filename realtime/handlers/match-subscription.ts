import type { Socket } from "socket.io";

import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { isActiveParticipantForUser } from "@/lib/matches/participant-access";
import { prisma } from "@/lib/prisma";

import { isMatchSubscribePayload } from "../../shared/match-events-validation";
import { matchRoomId } from "../lib/rooms";

type MatchSubscriptionStore = {
  match: Pick<typeof prisma.match, "findFirst">;
};

function emitMatchError(socket: Socket, error: string) {
  socket.emit("match:error", { error });
}

export function registerMatchSubscription(socket: Socket, db: MatchSubscriptionStore = prisma) {
  socket.on("match:subscribe", async (payload: unknown) => {
    if (!isMatchSubscribePayload(payload)) {
      emitMatchError(socket, "invalid_payload");
      return;
    }

    const { matchId, participantId } = payload;
    const userId = socket.data.user?.id;

    if (typeof userId !== "string" || userId.length === 0) {
      emitMatchError(socket, "unauthorized");
      return;
    }

    try {
      const match = await db.match.findFirst({
        where: {
          id: matchId,
          participants: {
            some: {
              id: participantId,
              leftAt: null,
              userId,
            },
          },
        },
        include: {
          moves: {
            orderBy: { moveNumber: "asc" },
          },
          participants: true,
        },
      });

      if (!match || !isActiveParticipantForUser(match.participants, participantId, userId)) {
        emitMatchError(socket, "participant_not_found");
        return;
      }

      const room = matchRoomId(matchId);
      await socket.join(room);

      console.log(`[realtime] ${socket.id} joined room ${room} as ${participantId}`);

      socket.emit("match:subscribed", {
        matchId,
        stateVersion: match.stateVersion,
      });
      socket.emit(
        "game:update",
        buildGameUpdatePayload({
          match,
          participants: match.participants,
          moves: match.moves,
        }),
      );
    } catch (error) {
      console.error("Failed to subscribe to match updates", error);
      emitMatchError(socket, "failed_to_subscribe");
    }
  });
}
