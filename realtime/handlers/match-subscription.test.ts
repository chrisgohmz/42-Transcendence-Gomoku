import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Socket } from "socket.io";

import { registerMatchSubscription } from "./match-subscription";

const findFirst = mock();
const join = mock();
const emit = mock();
const on = mock();

const db = {
  match: {
    findFirst,
  },
};

const createdAt = new Date("2026-05-12T00:00:00.000Z");

function buildSocket(userId: string | null = "user-black") {
  const handlers = new Map<string, (payload: unknown) => Promise<void>>();
  on.mockImplementation((event: string, handler: (payload: unknown) => Promise<void>) => {
    handlers.set(event, handler);
  });

  return {
    handlers,
    socket: {
      data: {
        user: userId ? { id: userId } : null,
      },
      emit,
      id: "socket-1",
      join,
      on,
    } as unknown as Socket,
  };
}

function matchRecord() {
  return {
    boardSize: 2,
    endReason: null,
    id: "match-1",
    moves: [
      {
        baseVersion: 0,
        createdAt,
        id: "move-1",
        matchId: "match-1",
        moveNumber: 1,
        participantId: "black-player",
        requestId: "request-1",
        stateVersion: 1,
        x: 0,
        y: 0,
      },
    ],
    nextTurnSeat: "WHITE",
    participants: [
      {
        displayNameSnapshot: "Black",
        id: "black-player",
        leftAt: null,
        matchId: "match-1",
        role: "PLAYER",
        seat: "BLACK",
        userId: "user-black",
      },
      {
        displayNameSnapshot: "White",
        id: "white-player",
        leftAt: null,
        matchId: "match-1",
        role: "PLAYER",
        seat: "WHITE",
        userId: "user-white",
      },
    ],
    stateVersion: 1,
    status: "IN_PROGRESS",
    visibility: "PUBLIC",
    winningSeat: null,
  };
}

beforeEach(() => {
  findFirst.mockReset();
  join.mockReset();
  emit.mockReset();
  on.mockReset();
  join.mockResolvedValue(undefined);
});

describe("registerMatchSubscription", () => {
  test("rejects malformed subscribe payloads", async () => {
    const { handlers, socket } = buildSocket();
    registerMatchSubscription(socket, db);

    await handlers.get("match:subscribe")?.({ matchId: "" });

    expect(emit).toHaveBeenCalledWith("match:error", { error: "invalid_payload" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  test("rejects subscriptions when the socket user does not own the participant", async () => {
    const { handlers, socket } = buildSocket("user-other");
    registerMatchSubscription(socket, db);
    findFirst.mockResolvedValueOnce(null);

    await handlers.get("match:subscribe")?.({
      matchId: "match-1",
      participantId: "black-player",
    });

    expect(findFirst).toHaveBeenCalledWith({
      include: {
        moves: {
          orderBy: { moveNumber: "asc" },
        },
        participants: true,
      },
      where: {
        id: "match-1",
        participants: {
          some: {
            id: "black-player",
            leftAt: null,
            userId: "user-other",
          },
        },
      },
    });
    expect(emit).toHaveBeenCalledWith("match:error", { error: "participant_not_found" });
    expect(join).not.toHaveBeenCalled();
  });

  test("joins authorized participants and sends a current full-state snapshot", async () => {
    const { handlers, socket } = buildSocket();
    registerMatchSubscription(socket, db);
    findFirst.mockResolvedValueOnce(matchRecord());

    await handlers.get("match:subscribe")?.({
      lastSeenStateVersion: 0,
      matchId: "match-1",
      participantId: "black-player",
    });

    expect(join).toHaveBeenCalledWith("match: match-1");
    expect(emit).toHaveBeenCalledWith("match:subscribed", {
      matchId: "match-1",
      stateVersion: 1,
    });
    expect(emit).toHaveBeenCalledWith(
      "game:update",
      expect.objectContaining({
        board: [
          [{ moveNumber: 1, occupied: true, seat: "BLACK" }, { occupied: false }],
          [{ occupied: false }, { occupied: false }],
        ],
        matchId: "match-1",
        moves: [
          expect.objectContaining({
            moveNumber: 1,
            position: { x: 0, y: 0 },
            stateVersion: 1,
          }),
        ],
        nextTurnSeat: "WHITE",
        stateVersion: 1,
      }),
    );
  });
});
