"use client";

import { io } from "socket.io-client";

function resolveSocketUrl(configuredUrl?: string) {
  if (configuredUrl) {
    return configuredUrl;
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    window.location.port === "3000"
  ) {
    return `http://${window.location.hostname}:3001`;
  }

  return undefined;
}

export function createSocket(configuredUrl?: string) {
  const socketUrl = resolveSocketUrl(configuredUrl);
  const options = {
    path: "/socket.io",
    withCredentials: true,
  };

  return socketUrl ? io(socketUrl, options) : io(options);
}
