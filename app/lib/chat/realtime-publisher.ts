// tells the Socket.IO server "a new chat message was saved".
//
// The Next.js API routes run on a different process than the Socket.IO server.
// They can't share memory. So Next.js sends an HTTP request to the Socket.IO
// server's internal API, and the Socket.IO server then broadcasts to clients.
//
// same pattern used for game moves:
//   app/lib/matches/realtime-publisher.ts → /internal/game-update
//   This file                             → /internal/chat-message

import { internalRealtimeSecretHeader, readRealtimeInternalSecret } from "../../../shared/realtime-internal";

// The shape of the data we send to the Socket.IO server
export type ChatMessagePayload = {
  conversationId: string;
  message: {
    id: string;
    body: string;
    createdAt: Date;
    sender: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
};

// Resolve the URL of the Socket.IO server's internal endpoint.
// Defaults to http://realtime:3001 which is the Docker service name.
// In local development (no Docker), set REALTIME_INTERNAL_URL in .env
function resolveChatMessageUrl(env: NodeJS.ProcessEnv = process.env): string {
  // Derive the base from the game update URL if set, otherwise use default
  const gameUpdateUrl = env["REALTIME_INTERNAL_URL"];
  if (gameUpdateUrl) {
    // Replace the game-update path with chat-message
    return gameUpdateUrl.replace("/internal/game-update", "/internal/chat-message");
  }
  return "http://realtime:3001/internal/chat-message";
}

export async function publishChatMessage(payload: ChatMessagePayload): Promise<void> {
  const internalSecret = readRealtimeInternalSecret();

  if (!internalSecret) {
    throw new Error("Missing REALTIME_INTERNAL_SECRET or BETTER_AUTH_SECRET");
  }

  // 2 second timeout — if the Socket.IO server is slow, don't hold up the response
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(resolveChatMessageUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // This secret proves the request comes from our own Next.js server,
        // not from an outside attacker
        [internalRealtimeSecretHeader]: internalSecret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Realtime server returned ${response.status}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
