import {
  forfeitDisconnectedParticipant,
  type DisconnectForfeitResult,
} from "@/lib/matches/disconnect-forfeit";

import type { GameUpdatePayload } from "../../shared/match-events";

export const remotePlayReconnectWindowMs = 60_000;

type TimeoutHandle = ReturnType<typeof setTimeout>;

type MatchSubscription = {
  matchId: string;
  participantId: string;
  socketId: string;
  userId: string;
};

type PendingForfeit = {
  matchId: string;
  participantId: string;
  timer: TimeoutHandle;
};

type RemoteMatchConnectionLogger = Pick<Console, "error" | "log">;

type RemoteMatchConnectionManagerOptions = {
  broadcastGameUpdate?: (payload: GameUpdatePayload) => void;
  clearTimeoutFn?: (timer: TimeoutHandle) => void;
  forfeitParticipant?: typeof forfeitDisconnectedParticipant;
  logger?: RemoteMatchConnectionLogger;
  reconnectWindowMs?: number;
  setTimeoutFn?: (callback: () => void, delayMs: number) => TimeoutHandle;
};

function subscriptionKey(matchId: string, participantId: string) {
  return `${matchId}\0${participantId}`;
}

function getResultLabel(result: DisconnectForfeitResult) {
  return result.kind;
}

export function createRemoteMatchConnectionManager({
  broadcastGameUpdate,
  clearTimeoutFn = clearTimeout,
  forfeitParticipant = forfeitDisconnectedParticipant,
  logger = console,
  reconnectWindowMs = remotePlayReconnectWindowMs,
  setTimeoutFn = setTimeout,
}: RemoteMatchConnectionManagerOptions = {}) {
  const subscriptionsBySocket = new Map<string, Map<string, MatchSubscription>>();
  const socketIdsByParticipant = new Map<string, Set<string>>();
  const pendingForfeits = new Map<string, PendingForfeit>();

  function getParticipantSocketCount(matchId: string, participantId: string) {
    return socketIdsByParticipant.get(subscriptionKey(matchId, participantId))?.size ?? 0;
  }

  async function resolveDisconnectTimeout(key: string, subscription: MatchSubscription) {
    const pending = pendingForfeits.get(key);
    if (!pending) {
      return;
    }

    pendingForfeits.delete(key);

    if (getParticipantSocketCount(subscription.matchId, subscription.participantId) > 0) {
      return;
    }

    const result = await forfeitParticipant(subscription.matchId, subscription.participantId, {
      shouldForfeit: () =>
        getParticipantSocketCount(subscription.matchId, subscription.participantId) === 0,
    });

    if (result.kind !== "forfeited") {
      logger.log(
        `[realtime] skipped disconnect forfeit for ${subscription.participantId} in ${subscription.matchId}: ${getResultLabel(
          result,
        )}`,
      );
      return;
    }

    broadcastGameUpdate?.(result.gameUpdate);
    logger.log(
      `[realtime] ${subscription.participantId} forfeited ${subscription.matchId} after disconnect timeout`,
    );
  }

  function scheduleForfeit(subscription: MatchSubscription) {
    const key = subscriptionKey(subscription.matchId, subscription.participantId);

    if (pendingForfeits.has(key)) {
      return;
    }

    const timer = setTimeoutFn(() => {
      void resolveDisconnectTimeout(key, subscription).catch((error: unknown) => {
        logger.error(
          `[realtime] disconnect forfeit failed for ${subscription.participantId} in ${subscription.matchId}:`,
          error,
        );
      });
    }, reconnectWindowMs);

    pendingForfeits.set(key, {
      matchId: subscription.matchId,
      participantId: subscription.participantId,
      timer,
    });
    logger.log(
      `[realtime] ${subscription.participantId} disconnected from ${subscription.matchId}; waiting ${reconnectWindowMs}ms before forfeit`,
    );
  }

  function registerSubscription(subscription: MatchSubscription) {
    const key = subscriptionKey(subscription.matchId, subscription.participantId);
    const socketSubscriptions = subscriptionsBySocket.get(subscription.socketId) ?? new Map();
    socketSubscriptions.set(key, subscription);
    subscriptionsBySocket.set(subscription.socketId, socketSubscriptions);

    const participantSockets = socketIdsByParticipant.get(key) ?? new Set<string>();
    participantSockets.add(subscription.socketId);
    socketIdsByParticipant.set(key, participantSockets);

    const pendingForfeit = pendingForfeits.get(key);
    if (pendingForfeit) {
      clearTimeoutFn(pendingForfeit.timer);
      pendingForfeits.delete(key);
      logger.log(
        `[realtime] ${subscription.participantId} reconnected to ${subscription.matchId}; disconnect forfeit cancelled`,
      );
    }
  }

  function handleSocketDisconnect(socketId: string) {
    const socketSubscriptions = subscriptionsBySocket.get(socketId);
    if (!socketSubscriptions) {
      return;
    }

    subscriptionsBySocket.delete(socketId);

    for (const [key, subscription] of socketSubscriptions) {
      const participantSockets = socketIdsByParticipant.get(key);
      if (!participantSockets) {
        continue;
      }

      participantSockets.delete(socketId);

      if (participantSockets.size > 0) {
        continue;
      }

      socketIdsByParticipant.delete(key);
      scheduleForfeit(subscription);
    }
  }

  return {
    getParticipantSocketCount,
    handleSocketDisconnect,
    registerSubscription,
  };
}
