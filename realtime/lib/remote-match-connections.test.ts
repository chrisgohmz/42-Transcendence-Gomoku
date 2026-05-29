import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { GameUpdatePayload } from "../../shared/match-events";
import { createRemoteMatchConnectionManager } from "./remote-match-connections";

const gameUpdate: GameUpdatePayload = {
  board: [[{ occupied: false }]],
  boardSize: 1,
  endReason: "disconnect_forfeit",
  lastMove: null,
  matchId: "match-1",
  moves: [],
  nextTurnSeat: null,
  participants: [
    {
      displayName: "Ada",
      participantId: "black-player",
      role: "PLAYER",
      seat: "BLACK",
    },
  ],
  stateVersion: 2,
  status: "FINISHED",
  visibility: "PUBLIC",
  winningSeat: "BLACK",
};

const broadcastGameUpdate = mock();
const clearTimeoutFn = mock();
const forfeitParticipant = mock();
const logger = {
  error: mock(),
  log: mock(),
};
const setTimeoutFn = mock();
let timers: Array<() => void>;

function createManager() {
  return createRemoteMatchConnectionManager({
    broadcastGameUpdate,
    clearTimeoutFn,
    forfeitParticipant,
    logger,
    reconnectWindowMs: 60_000,
    setTimeoutFn,
  });
}

async function flushAsyncTimer() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  timers = [];
  broadcastGameUpdate.mockReset();
  clearTimeoutFn.mockReset();
  forfeitParticipant.mockReset();
  logger.error.mockReset();
  logger.log.mockReset();
  setTimeoutFn.mockReset();

  setTimeoutFn.mockImplementation((callback: () => void) => {
    timers.push(callback);
    return timers.length as unknown as ReturnType<typeof setTimeout>;
  });
  forfeitParticipant.mockResolvedValue({
    gameUpdate,
    kind: "forfeited",
    matchId: "match-1",
    stateVersion: 2,
  });
});

describe("createRemoteMatchConnectionManager", () => {
  test("waits for the final participant socket before scheduling a forfeit", () => {
    const manager = createManager();

    manager.registerSubscription({
      matchId: "match-1",
      participantId: "black-player",
      socketId: "socket-1",
      userId: "user-black",
    });
    manager.registerSubscription({
      matchId: "match-1",
      participantId: "black-player",
      socketId: "socket-2",
      userId: "user-black",
    });

    manager.handleSocketDisconnect("socket-1");
    expect(setTimeoutFn).not.toHaveBeenCalled();

    manager.handleSocketDisconnect("socket-2");
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 60_000);
  });

  test("cancels a pending forfeit when the participant reconnects", async () => {
    const manager = createManager();

    manager.registerSubscription({
      matchId: "match-1",
      participantId: "black-player",
      socketId: "socket-1",
      userId: "user-black",
    });
    manager.handleSocketDisconnect("socket-1");

    manager.registerSubscription({
      matchId: "match-1",
      participantId: "black-player",
      socketId: "socket-2",
      userId: "user-black",
    });

    expect(clearTimeoutFn).toHaveBeenCalledWith(1);
    timers[0]?.();
    await flushAsyncTimer();
    expect(forfeitParticipant).not.toHaveBeenCalled();
  });

  test("broadcasts the authoritative game update when the reconnect window expires", async () => {
    const manager = createManager();

    manager.registerSubscription({
      matchId: "match-1",
      participantId: "white-player",
      socketId: "socket-1",
      userId: "user-white",
    });
    manager.handleSocketDisconnect("socket-1");
    timers[0]?.();
    await flushAsyncTimer();

    expect(forfeitParticipant).toHaveBeenCalledWith("match-1", "white-player", {
      shouldForfeit: expect.any(Function),
    });
    expect(broadcastGameUpdate).toHaveBeenCalledWith(gameUpdate);
  });
});
