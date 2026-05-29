import { describe, expect, test } from "bun:test";

import { getMatchmakingUserFromSocket } from "./socket-matchmaking-user";

describe("getMatchmakingUserFromSocket", () => {
  test("maps authenticated socket session user fields into a matchmaking user", () => {
    expect(
      getMatchmakingUserFromSocket({
        data: {
          user: {
            displayName: "Ada Lovelace",
            id: "user-ada",
            name: "Ada",
            username: "ada",
          },
        },
      }),
    ).toEqual({
      displayName: "Ada Lovelace",
      id: "user-ada",
      name: "Ada",
      username: "ada",
    });
  });

  test("normalizes optional profile fields and rejects unauthenticated sockets", () => {
    expect(
      getMatchmakingUserFromSocket({
        data: {
          user: {
            id: "user-ada",
          },
        },
      }),
    ).toEqual({
      displayName: null,
      id: "user-ada",
      name: null,
      username: null,
    });
    expect(getMatchmakingUserFromSocket({ data: {} })).toBeNull();
  });
});
