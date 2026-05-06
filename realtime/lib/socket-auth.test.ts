import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Socket } from "socket.io";

const { authenticateSocketSession, headersFromSocketRequest } = await import("./socket-auth");

const getSession = mock();
const next = mock();

function buildSocket(headers: Socket["request"]["headers"]): Socket {
  return {
    data: {},
    request: { headers },
  } as Socket;
}

beforeEach(() => {
  getSession.mockReset();
  next.mockReset();
});

describe("headersFromSocketRequest", () => {
  test("copies string and array headers into web Headers for Better Auth", () => {
    const headers = headersFromSocketRequest({
      cookie: "better-auth.session_token=abc",
      "x-forwarded-host": ["localhost:3000", "localhost:8443"],
    });

    expect(headers.get("cookie")).toBe("better-auth.session_token=abc");
    expect(headers.get("x-forwarded-host")).toBe("localhost:3000, localhost:8443");
  });
});

describe("authenticateSocketSession", () => {
  test("stores the Better Auth session user on socket data", async () => {
    const socket = buildSocket({ cookie: "better-auth.session_token=abc" });

    getSession.mockResolvedValueOnce({
      user: {
        id: "user-1",
        username: "ada",
      },
    });

    await authenticateSocketSession(socket, next, getSession);

    const authCall = getSession.mock.calls[0]?.[0] as { headers: Headers };
    expect(authCall.headers.get("cookie")).toBe("better-auth.session_token=abc");
    expect(socket.data.user).toMatchObject({
      id: "user-1",
      username: "ada",
    });
    expect(next.mock.calls).toEqual([[]]);
  });

  test("rejects sockets without an authenticated session", async () => {
    const socket = buildSocket({});

    getSession.mockResolvedValueOnce(null);

    await authenticateSocketSession(socket, next, getSession);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("unauthorized");
    expect(socket.data.user).toBeUndefined();
  });

  test("rejects sockets when session lookup throws", async () => {
    const socket = buildSocket({ cookie: "better-auth.session_token=abc" });

    getSession.mockRejectedValueOnce(new Error("database unavailable"));

    await authenticateSocketSession(socket, next, getSession);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("unauthorized");
    expect(socket.data.user).toBeUndefined();
  });
});
