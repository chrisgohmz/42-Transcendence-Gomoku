import { Prisma } from "../../../generated/prisma/client";
import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "../../../generated/prisma/enums";
import { prisma } from "../prisma";
import { standardGomokuBoardSize } from "./move-rules";

const matchmakingLockKey = 42_300_030;
const defaultWaitingTimeoutMs = 10 * 60 * 1000;
const defaultInProgressTimeoutMs = 30 * 60 * 1000;

export const endReasonQueueCancelled = "queue_cancelled";
export const endReasonQueueExpired = "queue_expired";
export const endReasonAbandoned = "abandoned";

type MatchmakingTransaction = Prisma.TransactionClient;

export type MatchmakingUser = {
  displayName?: string | null;
  id: string;
  name?: string | null;
  username?: string | null;
};

type QueueParticipant = {
  id: string;
  userId: string | null;
  displayNameSnapshot: string;
  role: Role;
  seat: Seat | null;
  joinedAt?: Date;
  leftAt?: Date | null;
  user?: {
    username: string;
    displayName: string;
  } | null;
};

type QueueMatch = {
  id: string;
  status: MatchStatus;
  visibility: MatchVisibility;
  boardSize: number;
  stateVersion?: number;
  nextTurnSeat: Seat | null;
  winningSeat?: Seat | null;
  endReason?: string | null;
  createdAt: Date;
  startedAt: Date | null;
  participants: QueueParticipant[];
};

export type MatchmakingSession = {
  matchId: string;
  participantId: string;
  role: Role;
  seat: Seat | null;
  status: MatchStatus;
  displayName: string;
  createdAt: string;
  startedAt: string | null;
};

export type MatchedQueueNotification = {
  session: MatchmakingSession;
  username: string | null;
};

export type JoinMatchmakingQueueResult =
  | {
      kind: "queued";
      session: MatchmakingSession;
      queuePosition: number;
    }
  | {
      kind: "matched";
      session: MatchmakingSession;
      opponent?: MatchedQueueNotification;
    };

export type CancelMatchmakingQueueResult =
  | {
      kind: "cancelled";
      matchId: string;
    }
  | {
      kind: "not_queued";
    }
  | {
      kind: "already_matched";
      session: MatchmakingSession;
    };

export type MatchmakingQueueStatus =
  | {
      kind: "queued";
      session: MatchmakingSession;
      queuePosition: number;
    }
  | {
      kind: "matched";
      session: MatchmakingSession;
    }
  | {
      kind: "not_queued";
    };

export type CleanupMatchSessionsResult = {
  waitingCancelled: number;
  inProgressCancelled: number;
};

type LifecycleOptions = {
  now?: Date;
  waitingTimeoutMs?: number;
  inProgressTimeoutMs?: number;
  useAdvisoryLock?: boolean;
};

type QueueOptions = LifecycleOptions & {
  boardSize?: number;
};

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveWaitingTimeoutMs(options: LifecycleOptions): number {
  return (
    options.waitingTimeoutMs ??
    readPositiveInteger(process.env["MATCHMAKING_WAITING_TIMEOUT_MS"], defaultWaitingTimeoutMs)
  );
}

function resolveInProgressTimeoutMs(options: LifecycleOptions): number {
  return (
    options.inProgressTimeoutMs ??
    readPositiveInteger(
      process.env["MATCH_IN_PROGRESS_ABANDONED_TIMEOUT_MS"],
      defaultInProgressTimeoutMs,
    )
  );
}

function timeoutCutoff(now: Date, timeoutMs: number): Date | null {
  return timeoutMs > 0 ? new Date(now.getTime() - timeoutMs) : null;
}

async function acquireMatchmakingLock(tx: MatchmakingTransaction, options: LifecycleOptions) {
  if (options.useAdvisoryLock === false) {
    return;
  }

  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${matchmakingLockKey})`);
}

function getDisplayName(user: MatchmakingUser): string {
  const displayName = user.displayName?.trim() || user.name?.trim() || user.username?.trim();
  return displayName || "Player";
}

function serializeSession(match: QueueMatch, participant: QueueParticipant): MatchmakingSession {
  return {
    createdAt: match.createdAt.toISOString(),
    displayName: participant.displayNameSnapshot,
    matchId: match.id,
    participantId: participant.id,
    role: participant.role,
    seat: participant.seat,
    startedAt: match.startedAt ? match.startedAt.toISOString() : null,
    status: match.status,
  };
}

function notificationFor(
  match: QueueMatch,
  participant: QueueParticipant,
): MatchedQueueNotification {
  return {
    session: serializeSession(match, participant),
    username: participant.user?.username ?? null,
  };
}

async function findActiveParticipant(
  tx: MatchmakingTransaction,
  userId: string,
  boardSize: number,
) {
  return tx.matchParticipant.findFirst({
    where: {
      leftAt: null,
      role: Role.PLAYER,
      userId,
      match: {
        boardSize,
        status: {
          in: [MatchStatus.WAITING, MatchStatus.IN_PROGRESS],
        },
      },
    },
    include: {
      match: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  displayName: true,
                  username: true,
                },
              },
            },
            orderBy: {
              joinedAt: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      joinedAt: "desc",
    },
  });
}

async function findWaitingOpponentMatch(
  tx: MatchmakingTransaction,
  userId: string,
  boardSize: number,
) {
  const candidates = await tx.match.findMany({
    where: {
      boardSize,
      ruleType: RuleType.GOMOKU,
      status: MatchStatus.WAITING,
      visibility: MatchVisibility.PUBLIC,
      participants: {
        none: {
          userId,
        },
        some: {
          leftAt: null,
          role: Role.PLAYER,
          seat: Seat.BLACK,
          userId: {
            not: null,
          },
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 10,
  });

  return candidates.find(
    (match) =>
      match.participants.filter(
        (participant) => participant.leftAt === null && participant.role === Role.PLAYER,
      ).length === 1 && match.participants[0]?.seat === Seat.BLACK,
  );
}

async function cancelMatches(
  tx: MatchmakingTransaction,
  matchIds: string[],
  now: Date,
  endReason: string,
) {
  if (matchIds.length === 0) {
    return 0;
  }

  const updatedMatches = await tx.match.updateMany({
    where: {
      id: {
        in: matchIds,
      },
      status: {
        in: [MatchStatus.WAITING, MatchStatus.IN_PROGRESS],
      },
    },
    data: {
      endReason,
      finishedAt: now,
      nextTurnSeat: null,
      status: MatchStatus.CANCELLED,
    },
  });

  await tx.matchParticipant.updateMany({
    where: {
      leftAt: null,
      matchId: {
        in: matchIds,
      },
      result: null,
    },
    data: {
      leftAt: now,
      result: MatchResult.CANCELLED,
    },
  });

  return updatedMatches.count;
}

async function cleanupStaleMatchSessionsInTransaction(
  tx: MatchmakingTransaction,
  options: LifecycleOptions,
): Promise<CleanupMatchSessionsResult> {
  const now = options.now ?? new Date();
  const waitingCutoff = timeoutCutoff(now, resolveWaitingTimeoutMs(options));
  const inProgressCutoff = timeoutCutoff(now, resolveInProgressTimeoutMs(options));

  let waitingCancelled = 0;
  let inProgressCancelled = 0;

  if (waitingCutoff) {
    const staleWaitingMatches = await tx.match.findMany({
      where: {
        status: MatchStatus.WAITING,
        updatedAt: {
          lt: waitingCutoff,
        },
      },
      select: {
        id: true,
      },
    });

    waitingCancelled = await cancelMatches(
      tx,
      staleWaitingMatches.map((match) => match.id),
      now,
      endReasonQueueExpired,
    );
  }

  if (inProgressCutoff) {
    const staleInProgressMatches = await tx.match.findMany({
      where: {
        status: MatchStatus.IN_PROGRESS,
        updatedAt: {
          lt: inProgressCutoff,
        },
      },
      select: {
        id: true,
      },
    });

    inProgressCancelled = await cancelMatches(
      tx,
      staleInProgressMatches.map((match) => match.id),
      now,
      endReasonAbandoned,
    );
  }

  return {
    inProgressCancelled,
    waitingCancelled,
  };
}

export async function cleanupStaleMatchSessions(
  options: LifecycleOptions = {},
): Promise<CleanupMatchSessionsResult> {
  return prisma.$transaction(async (tx) => {
    await acquireMatchmakingLock(tx, options);
    return cleanupStaleMatchSessionsInTransaction(tx, options);
  });
}

export async function joinMatchmakingQueue(
  user: MatchmakingUser,
  options: QueueOptions = {},
): Promise<JoinMatchmakingQueueResult> {
  const now = options.now ?? new Date();
  const boardSize = options.boardSize ?? standardGomokuBoardSize;

  return prisma.$transaction(async (tx) => {
    await acquireMatchmakingLock(tx, options);
    await cleanupStaleMatchSessionsInTransaction(tx, { ...options, now });

    const activeParticipant = await findActiveParticipant(tx, user.id, boardSize);
    if (activeParticipant) {
      const match = activeParticipant.match as QueueMatch;
      const session = serializeSession(match, activeParticipant);

      if (match.status === MatchStatus.IN_PROGRESS) {
        return {
          kind: "matched",
          session,
        };
      }

      return {
        kind: "queued",
        queuePosition: 1,
        session,
      };
    }

    const opponentMatch = await findWaitingOpponentMatch(tx, user.id, boardSize);
    if (opponentMatch) {
      const joiner = await tx.matchParticipant.create({
        data: {
          displayNameSnapshot: getDisplayName(user),
          matchId: opponentMatch.id,
          role: Role.PLAYER,
          seat: Seat.WHITE,
          userId: user.id,
        },
      });

      await tx.match.update({
        where: {
          id: opponentMatch.id,
        },
        data: {
          nextTurnSeat: Seat.BLACK,
          startedAt: now,
          stateVersion: {
            increment: 1,
          },
          status: MatchStatus.IN_PROGRESS,
        },
      });
      const startedStateVersion = (opponentMatch.stateVersion ?? 0) + 1;

      const matchedMatch: QueueMatch = {
        ...opponentMatch,
        nextTurnSeat: Seat.BLACK,
        participants: [...opponentMatch.participants, joiner],
        startedAt: now,
        stateVersion: startedStateVersion,
        status: MatchStatus.IN_PROGRESS,
      };
      const opponent = opponentMatch.participants[0];

      return {
        kind: "matched",
        opponent: opponent ? notificationFor(matchedMatch, opponent) : undefined,
        session: serializeSession(matchedMatch, joiner),
      };
    }

    const queuedMatch = await tx.match.create({
      data: {
        boardSize,
        createdByUserId: user.id,
        participants: {
          create: {
            displayNameSnapshot: getDisplayName(user),
            role: Role.PLAYER,
            seat: Seat.BLACK,
            userId: user.id,
          },
        },
        ruleType: RuleType.GOMOKU,
        status: MatchStatus.WAITING,
        visibility: MatchVisibility.PUBLIC,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
      },
    });
    const participant = queuedMatch.participants[0];

    if (!participant) {
      throw new Error("Queued match participant was not created.");
    }

    return {
      kind: "queued",
      queuePosition: 1,
      session: serializeSession(queuedMatch, participant),
    };
  });
}

export async function cancelMatchmakingQueue(
  user: MatchmakingUser,
  options: QueueOptions = {},
): Promise<CancelMatchmakingQueueResult> {
  const now = options.now ?? new Date();
  const boardSize = options.boardSize ?? standardGomokuBoardSize;

  return prisma.$transaction(async (tx) => {
    await acquireMatchmakingLock(tx, options);
    await cleanupStaleMatchSessionsInTransaction(tx, { ...options, now });

    const activeParticipant = await findActiveParticipant(tx, user.id, boardSize);
    if (!activeParticipant) {
      return { kind: "not_queued" };
    }

    const match = activeParticipant.match as QueueMatch;
    if (match.status === MatchStatus.IN_PROGRESS) {
      return {
        kind: "already_matched",
        session: serializeSession(match, activeParticipant),
      };
    }

    const updated = await tx.match.updateMany({
      where: {
        id: match.id,
        status: MatchStatus.WAITING,
      },
      data: {
        endReason: endReasonQueueCancelled,
        finishedAt: now,
        nextTurnSeat: null,
        status: MatchStatus.CANCELLED,
      },
    });

    if (updated.count !== 1) {
      const refreshedParticipant = await findActiveParticipant(tx, user.id, boardSize);
      if (refreshedParticipant?.match.status === MatchStatus.IN_PROGRESS) {
        return {
          kind: "already_matched",
          session: serializeSession(refreshedParticipant.match as QueueMatch, refreshedParticipant),
        };
      }

      return { kind: "not_queued" };
    }

    await tx.matchParticipant.updateMany({
      where: {
        leftAt: null,
        matchId: match.id,
        result: null,
      },
      data: {
        leftAt: now,
        result: MatchResult.CANCELLED,
      },
    });

    return {
      kind: "cancelled",
      matchId: match.id,
    };
  });
}

export async function getMatchmakingQueueStatus(
  user: MatchmakingUser,
  options: QueueOptions = {},
): Promise<MatchmakingQueueStatus> {
  const now = options.now ?? new Date();
  const boardSize = options.boardSize ?? standardGomokuBoardSize;

  return prisma.$transaction(async (tx) => {
    await acquireMatchmakingLock(tx, options);
    await cleanupStaleMatchSessionsInTransaction(tx, { ...options, now });

    const activeParticipant = await findActiveParticipant(tx, user.id, boardSize);
    if (!activeParticipant) {
      return { kind: "not_queued" };
    }

    const match = activeParticipant.match as QueueMatch;
    const session = serializeSession(match, activeParticipant);

    if (match.status === MatchStatus.IN_PROGRESS) {
      return {
        kind: "matched",
        session,
      };
    }

    return {
      kind: "queued",
      queuePosition: 1,
      session,
    };
  });
}

export async function getGlobalMatchStats() {
  const searching = await prisma.match.count({
    where: {
      status: MatchStatus.WAITING,
      visibility: MatchVisibility.PUBLIC,
    },
  });

  const liveGames = await prisma.match.count({
    where: {
      status: MatchStatus.IN_PROGRESS,
    },
  });

  return { searching, liveGames };
}
