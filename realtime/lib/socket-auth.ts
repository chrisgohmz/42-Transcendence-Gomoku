import type { Socket } from "socket.io";

import { auth } from "@/lib/auth";

type SocketMiddlewareNext = (error?: Error) => void;
type SocketSessionLookup = typeof auth.api.getSession;

export function headersFromSocketRequest(headers: Socket["request"]["headers"]) {
  const webHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      webHeaders.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => webHeaders.append(key, item));
    }
  }

  return webHeaders;
}

export async function authenticateSocketSession(
  socket: Socket,
  next: SocketMiddlewareNext,
  getSession: SocketSessionLookup = auth.api.getSession,
) {
  try {
    const sessionData = await getSession({
      headers: headersFromSocketRequest(socket.request.headers),
    });

    if (!sessionData) {
      return next(new Error("unauthorized"));
    }

    socket.data.user = sessionData.user;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
}
