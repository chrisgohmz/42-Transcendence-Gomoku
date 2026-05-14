import type { Prisma } from "../../../generated/prisma/client";
import { MatchStatus } from "../../../generated/prisma/enums";
import { buildBoard } from "../game/state-builder";
import { prisma } from "../prisma";

export const MATCH_HISTORY_DEFAULT_LIMIT = 20;
export const MATCH_HISTORY_MAX_LIMIT = 100;

export const terminalMatchStatuses = [MatchStatus.FINISHED, MatchStatus.CANCELLED] as const;

export const matchHistorySelect = {
  boardSize: true,
  createdAt: true,
  endReason: true,
  finishedAt: true,
  id: true,
  moves: {
    orderBy: {
      moveNumber: "asc",
    },
    select: {
      baseVersion: true,
      createdAt: true,
      moveNumber: true,
      participantId: true,
      requestId: true,
      stateVersion: true,
      x: true,
      y: true,
    },
  },
  participants: {
    orderBy: {
      joinedAt: "asc",
    },
    select: {
      displayNameSnapshot: true,
      id: true,
      joinedAt: true,
      leftAt: true,
      result: true,
      role: true,
      seat: true,
      user: {
        select: {
          displayName: true,
          id: true,
          username: true,
        },
      },
      userId: true,
    },
  },
  ruleType: true,
  startedAt: true,
  stateVersion: true,
  status: true,
  updatedAt: true,
  visibility: true,
  winningSeat: true,
} satisfies Prisma.MatchSelect;

export type MatchHistoryRecord = Prisma.MatchGetPayload<{
  select: typeof matchHistorySelect;
}>;

export type MatchHistoryParticipant = {
  participantId: string;
  userId: string | null;
  username: string | null;
  displayName: string;
  displayNameSnapshot: string;
  role: MatchHistoryRecord["participants"][number]["role"];
  seat: MatchHistoryRecord["participants"][number]["seat"];
  result: MatchHistoryRecord["participants"][number]["result"];
  joinedAt: string;
  leftAt: string | null;
};

export type MatchHistoryMove = {
  moveNumber: number;
  participantId: string;
  position: {
    x: number;
    y: number;
  };
  requestId: string | null;
  baseVersion: number | null;
  stateVersion: number;
  playedAt: string;
};

export type MatchHistoryEntry = {
  matchId: string;
  status: MatchHistoryRecord["status"];
  visibility: MatchHistoryRecord["visibility"];
  ruleType: MatchHistoryRecord["ruleType"];
  boardSize: number;
  stateVersion: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  winningSeat: MatchHistoryRecord["winningSeat"];
  endReason: string | null;
  currentUserParticipantId: string | null;
  result: MatchHistoryRecord["participants"][number]["result"];
  opponentUserIds: string[];
  participants: MatchHistoryParticipant[];
  moves: MatchHistoryMove[];
  moveCount: number;
  board: ReturnType<typeof buildBoard>;
};

export function normalizeMatchHistoryLimit(limit: number | null | undefined): number {
  if (limit == null) {
    return MATCH_HISTORY_DEFAULT_LIMIT;
  }

  if (!Number.isInteger(limit)) {
    return MATCH_HISTORY_DEFAULT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MATCH_HISTORY_MAX_LIMIT);
}

export function buildMatchHistoryQuery(userId: string, limit = MATCH_HISTORY_DEFAULT_LIMIT) {
  return {
    orderBy: [
      {
        finishedAt: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    select: matchHistorySelect,
    take: normalizeMatchHistoryLimit(limit),
    where: {
      participants: {
        some: {
          userId,
        },
      },
      status: {
        in: [...terminalMatchStatuses],
      },
    },
  } satisfies Prisma.MatchFindManyArgs;
}

function serializeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function serializeParticipant(
  participant: MatchHistoryRecord["participants"][number],
): MatchHistoryParticipant {
  return {
    displayName: participant.user?.displayName ?? participant.displayNameSnapshot,
    displayNameSnapshot: participant.displayNameSnapshot,
    joinedAt: participant.joinedAt.toISOString(),
    leftAt: serializeDate(participant.leftAt),
    participantId: participant.id,
    result: participant.result,
    role: participant.role,
    seat: participant.seat,
    userId: participant.userId,
    username: participant.user?.username ?? null,
  };
}

function serializeMove(move: MatchHistoryRecord["moves"][number]): MatchHistoryMove {
  return {
    baseVersion: move.baseVersion,
    moveNumber: move.moveNumber,
    participantId: move.participantId,
    playedAt: move.createdAt.toISOString(),
    position: {
      x: move.x,
      y: move.y,
    },
    requestId: move.requestId,
    stateVersion: move.stateVersion,
  };
}

export function toMatchHistoryEntry(
  match: MatchHistoryRecord,
  currentUserId: string,
): MatchHistoryEntry {
  const participants = match.participants.map(serializeParticipant);
  const moves = [...match.moves].sort((a, b) => a.moveNumber - b.moveNumber).map(serializeMove);
  const currentUserParticipant =
    participants.find((participant) => participant.userId === currentUserId) ?? null;
  const opponentUserIds = participants
    .filter(
      (participant) =>
        participant.role === "PLAYER" &&
        participant.userId !== null &&
        participant.userId !== currentUserId,
    )
    .map((participant) => participant.userId as string);

  return {
    board: buildBoard(match.boardSize, match.participants, match.moves),
    boardSize: match.boardSize,
    createdAt: match.createdAt.toISOString(),
    currentUserParticipantId: currentUserParticipant?.participantId ?? null,
    endReason: match.endReason,
    finishedAt: serializeDate(match.finishedAt),
    matchId: match.id,
    moveCount: moves.length,
    moves,
    opponentUserIds,
    participants,
    result: currentUserParticipant?.result ?? null,
    ruleType: match.ruleType,
    startedAt: serializeDate(match.startedAt),
    stateVersion: match.stateVersion,
    status: match.status,
    updatedAt: match.updatedAt.toISOString(),
    visibility: match.visibility,
    winningSeat: match.winningSeat,
  };
}

export async function getMatchHistoryForUser(
  userId: string,
  limit = MATCH_HISTORY_DEFAULT_LIMIT,
): Promise<MatchHistoryEntry[]> {
  const matches = await prisma.match.findMany(buildMatchHistoryQuery(userId, limit));

  return matches.map((match) => toMatchHistoryEntry(match, userId));
}
