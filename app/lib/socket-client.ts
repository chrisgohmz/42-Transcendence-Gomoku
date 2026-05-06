"use client";

import { io } from "socket.io-client";

type SocketLocation = Pick<Location, "hostname" | "port">;

export function resolveSocketUrl(
  configuredUrl?: string,
  location: SocketLocation | undefined = typeof window === "undefined"
    ? undefined
    : window.location,
) {
  if (configuredUrl) {
    return configuredUrl;
  }

  if (
    location &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1") &&
    location.port === "3000"
  ) {
    return `http://${location.hostname}:3001`;
  }

  return undefined;
}

export function createSocket(configuredUrl?: string, location?: SocketLocation) {
  const socketUrl = resolveSocketUrl(configuredUrl, location);
  const options = {
    path: "/socket.io",
    withCredentials: true,
  };

  return socketUrl ? io(socketUrl, options) : io(options);
}
