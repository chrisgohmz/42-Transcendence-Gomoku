import { beforeEach, describe, expect, mock, test } from "bun:test";

const io = mock(() => ({ connected: false }));

await mock.module("socket.io-client", () => ({
  io,
}));

const { createSocket, resolveSocketUrl } = await import("./socket-client");

beforeEach(() => {
  io.mockClear();
});

describe("createSocket", () => {
  test("passes configured URLs through with credentialed Socket.IO options", () => {
    createSocket("https://localhost:8443");

    expect(io).toHaveBeenCalledWith("https://localhost:8443", {
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: true,
    });
  });

  test("uses a direct local realtime URL when the Next app runs on localhost:3000", () => {
    createSocket(undefined, { hostname: "localhost", port: "3000" });

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: true,
    });
  });

  test("uses same-origin Socket.IO when no direct host fallback is needed", () => {
    createSocket(undefined, { hostname: "gomoku.example", port: "" });

    expect(io).toHaveBeenCalledWith({
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: true,
    });
  });
});

describe("resolveSocketUrl", () => {
  test("keeps explicit socket URLs ahead of browser location fallbacks", () => {
    expect(
      resolveSocketUrl("https://realtime.example", { hostname: "localhost", port: "3000" }),
    ).toBe("https://realtime.example");
  });

  test("returns undefined for same-origin socket routing", () => {
    expect(resolveSocketUrl(undefined, { hostname: "localhost", port: "8443" })).toBeUndefined();
  });
});
