import {
  internalRealtimeSecretHeader,
  isChatMessagePayload,
  readRealtimeInternalSecret,
  type ChatMessagePayload,
} from "../../shared/realtime-internal";
import { convRoomId } from "./rooms";

type ChatMessageEmitter = {
  emit(event: "chat:message", payload: ChatMessagePayload["message"]): void;
  emit(event: "chat:refresh", payload: { conversationId: string }): void;
};

type ChatMessageServer = {
  to(room: string): ChatMessageEmitter;
};

function getUnauthorizedResponse() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function handleInternalChatMessage(
  request: Request,
  io: ChatMessageServer,
  internalSecret = readRealtimeInternalSecret(),
  logger: Pick<Console, "log"> = console,
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

  if (!isChatMessagePayload(payload)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const room = convRoomId(payload.conversationId);

  io.to(room).emit("chat:message", payload.message);
  for (const username of getRefreshUsernames(payload)) {
    io.to(`user:${username}`).emit("chat:refresh", { conversationId: payload.conversationId });
  }
  logger.log(`[realtime] broadcast chat:message to ${room}`);

  return Response.json({ ok: true, room });
}

function getRefreshUsernames(payload: ChatMessagePayload): string[] {
  return Array.from(
    new Set(
      [payload.message.sender?.username, payload.recipientUsername].filter(
        (username): username is string => typeof username === "string" && username.length > 0,
      ),
    ),
  );
}
