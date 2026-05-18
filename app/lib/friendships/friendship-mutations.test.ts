import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const deleteFriendship = mock();
const findManyUsers = mock();
const consoleError = mock();
const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalConsoleError = console.error;
const originalFetch = globalThis.fetch;
const originalRealtimeInternalSecret = process.env["REALTIME_INTERNAL_SECRET"];
const originalRealtimeFriendshipInternalUrl = process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"];

await mock.module("@/lib/prisma", () => ({
  prisma: {
    friendship: {
      delete: deleteFriendship,
    },
    user: {
      findMany: findManyUsers,
    },
  },
}));

const { deleteFriendshipAndNotify, getLowHighIds } = await import("./friendship-mutations");

beforeEach(() => {
  deleteFriendship.mockReset();
  findManyUsers.mockReset();
  consoleError.mockReset();
  fetchMock.mockReset();
  console.error = consoleError as unknown as typeof console.error;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env["REALTIME_INTERNAL_SECRET"] = "friend-secret";
  process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"] =
    "http://localhost:3001/internal/friendship-update";

  deleteFriendship.mockResolvedValue({});
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  findManyUsers.mockResolvedValue([
    { id: "user-high", username: "bob" },
    { id: "user-low", username: "alice" },
  ]);
});

afterEach(() => {
  console.error = originalConsoleError;
  globalThis.fetch = originalFetch;

  if (originalRealtimeInternalSecret === undefined) {
    delete process.env["REALTIME_INTERNAL_SECRET"];
  } else {
    process.env["REALTIME_INTERNAL_SECRET"] = originalRealtimeInternalSecret;
  }

  if (originalRealtimeFriendshipInternalUrl === undefined) {
    delete process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"];
  } else {
    process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"] = originalRealtimeFriendshipInternalUrl;
  }
});

describe("getLowHighIds", () => {
  test("orders friendship ids for the composite key", () => {
    expect(getLowHighIds("user-z", "user-a")).toEqual({
      userLowId: "user-a",
      userHighId: "user-z",
    });
  });
});

describe("deleteFriendshipAndNotify", () => {
  test("deletes by friendship id and publishes refreshes for both users", async () => {
    await deleteFriendshipAndNotify({
      id: 42,
      userLowId: "user-low",
      userHighId: "user-high",
    });

    expect(deleteFriendship).toHaveBeenCalledWith({
      where: { id: 42 },
    });
    expect(findManyUsers).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["user-low", "user-high"],
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;

    expect(call).toBeDefined();
    expect(call?.[0]).toBe("http://localhost:3001/internal/friendship-update");
    expect(call?.[1].body).toBe(JSON.stringify({ usernames: ["alice", "bob"] }));
  });

  test("keeps the delete successful when realtime notification fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await deleteFriendshipAndNotify({
      id: 42,
      userLowId: "user-low",
      userHighId: "user-high",
    });

    expect(deleteFriendship).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to notify realtime server",
      expect.any(Error),
    );
  });
});
