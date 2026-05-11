import { describe, expect, test } from "bun:test";

import { resolveFriendshipNotificationTarget } from "./friendship-notifications";

function createStore({
  friendshipExists,
  target,
}: {
  friendshipExists: boolean;
  target: { id: string; username: string } | null;
}) {
  let requestedFriendshipKey:
    | {
        userHighId: string;
        userLowId: string;
      }
    | undefined;

  return {
    get requestedFriendshipKey() {
      return requestedFriendshipKey;
    },
    friendship: {
      async findUnique(args: {
        where: {
          userLowId_userHighId: {
            userHighId: string;
            userLowId: string;
          };
        };
      }) {
        requestedFriendshipKey = args.where.userLowId_userHighId;
        return friendshipExists ? { id: 42 } : null;
      },
    },
    user: {
      async findUnique() {
        return target;
      },
    },
  };
}

describe("resolveFriendshipNotificationTarget", () => {
  test("returns the canonical target username when a friendship record exists", async () => {
    const store = createStore({
      friendshipExists: true,
      target: { id: "user-b", username: "rival" },
    });

    const targetUsername = await resolveFriendshipNotificationTarget(store, "user-a", "rival");

    expect(targetUsername).toBe("rival");
    expect(store.requestedFriendshipKey).toEqual({
      userLowId: "user-a",
      userHighId: "user-b",
    });
  });

  test("orders friendship ids before querying the composite key", async () => {
    const store = createStore({
      friendshipExists: true,
      target: { id: "user-a", username: "rival" },
    });

    await resolveFriendshipNotificationTarget(store, "user-b", "rival");

    expect(store.requestedFriendshipKey).toEqual({
      userLowId: "user-a",
      userHighId: "user-b",
    });
  });

  test("rejects notification targets without a friendship record", async () => {
    const store = createStore({
      friendshipExists: false,
      target: { id: "user-b", username: "stranger" },
    });

    const targetUsername = await resolveFriendshipNotificationTarget(store, "user-a", "stranger");

    expect(targetUsername).toBeNull();
  });

  test("rejects notification targets that do not exist", async () => {
    const store = createStore({
      friendshipExists: true,
      target: null,
    });

    const targetUsername = await resolveFriendshipNotificationTarget(store, "user-a", "missing");

    expect(targetUsername).toBeNull();
    expect(store.requestedFriendshipKey).toBeUndefined();
  });
});
