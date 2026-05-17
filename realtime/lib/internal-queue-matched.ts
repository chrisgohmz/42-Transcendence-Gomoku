import {
  internalRealtimeSecretHeader,
  readRealtimeInternalSecret,
} from "../../shared/realtime-internal";

export async function handleInternalQueueMatched(
  request: Request,
  io: any,
  internalSecret = readRealtimeInternalSecret(),
) {
  if (!internalSecret) {
    return Response.json({ error: "internal_secret_unconfigured" }, { status: 503 });
  }

  if (request.headers.get(internalRealtimeSecretHeader) !== internalSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { username, session } = payload;

  if (username && session) {
    io.to(`user:${username}`).emit("queue:matched", session);
    io.to(`user:${username}`).emit("queue:status", {
      kind: "matched",
      session,
    });
    console.log(`[realtime] broadcast queue:matched to user:${username}`);
  }

  return Response.json({ ok: true });
}
