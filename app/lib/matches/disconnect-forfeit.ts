import type { Prisma } from "../../../generated/prisma/client";
import { MatchResult, MatchStatus, Role } from "../../../generated/prisma/enums";
import type { GameUpdatePayload } from "../../../shared/match-events";
import { prisma } from "../prisma";
import { syncUserGameStatsForUser } from "../stats/result-sync";
import { buildGameUpdatePayload } from "./game-update";

export const endReasonDisconnectForfeit = "disconnect_forfeit";

type DisconnectForfeitDb = Pick<typeof prisma, "$transaction">;

export type DisconnectForfeitResult =
  | {
      gameUpdate: GameUpdatePayload;
      kind: "forfeited";
      matchId: string;
      stateVersion: number;
    }
  | {
      kind:
        | "match_not_found"
        | "not_in_progress"
        | "opponent_not_found"
        | "participant_not_found"
        | "reconnected"
        | "stale_state";
      matchId: string;
    };

type DisconnectForfeitOptions = {
  db?: DisconnectForfeitDb;
  now?: Date;
  shouldForfeit?: () => boolean;
  syncStats?: boolean;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getHumanPlayerUserIds(
  participants: Array<{ role: Role; userId: string | null }>,
): string[] {
  const userIds = new Set<string>();
  for (const participant of participants) {
    if (participant.role === Role.PLAYER && participant.userId) {
      userIds.add(participant.userId);
    }
  }
  return [...userIds];
}

export async function forfeitDisconnectedParticipant(
  matchId: string,
  participantId: string,
  {
    db = prisma,
    now = new Date(),
    shouldForfeit = () => true,
    syncStats = true,
  }: DisconnectForfeitOptions = {},
): Promise<DisconnectForfeitResult> {
  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        moves: {
          orderBy: { moveNumber: "asc" },
        },
        participants: true,
      },
    });

    if (!match) {
      return { kind: "match_not_found" as const, matchId };
    }

    if (match.status !== MatchStatus.IN_PROGRESS) {
      return { kind: "not_in_progress" as const, matchId };
    }

    const disconnectedParticipant = match.participants.find(
      (participant) =>
        participant.id === participantId &&
        participant.leftAt === null &&
        participant.role === Role.PLAYER &&
        participant.seat !== null,
    );

    if (!disconnectedParticipant) {
      return { kind: "participant_not_found" as const, matchId };
    }

    const opponent = match.participants.find(
      (participant) =>
        participant.id !== disconnectedParticipant.id &&
        participant.leftAt === null &&
        participant.role === Role.PLAYER &&
        participant.seat !== null,
    );

    if (!opponent?.seat) {
      return { kind: "opponent_not_found" as const, matchId };
    }

    if (!shouldForfeit()) {
      return { kind: "reconnected" as const, matchId };
    }

    const nextStateVersion = match.stateVersion + 1;
    const matchUpdate = {
      endReason: endReasonDisconnectForfeit,
      finishedAt: now,
      nextTurnSeat: null,
      stateVersion: nextStateVersion,
      status: MatchStatus.FINISHED,
      winningSeat: opponent.seat,
    };
    const guardedTransition = await tx.match.updateMany({
      where: {
        id: matchId,
        stateVersion: match.stateVersion,
        status: MatchStatus.IN_PROGRESS,
      },
      data: matchUpdate,
    });

    if (guardedTransition.count !== 1) {
      return { kind: "stale_state" as const, matchId };
    }

    await Promise.all([
      tx.matchParticipant.update({
        where: { id: disconnectedParticipant.id },
        data: { result: MatchResult.LOSS },
      }),
      tx.matchParticipant.update({
        where: { id: opponent.id },
        data: { result: MatchResult.WIN },
      }),
    ]);

    return {
      gameUpdate: buildGameUpdatePayload({
        match: { ...match, ...matchUpdate },
        moves: match.moves,
        participants: match.participants,
      }),
      humanPlayerUserIds: getHumanPlayerUserIds(match.participants),
      kind: "forfeited" as const,
      matchId,
      stateVersion: nextStateVersion,
    };
  });

  if (result.kind === "forfeited" && syncStats && result.humanPlayerUserIds.length > 0) {
    try {
      await Promise.all(
        result.humanPlayerUserIds.map((userId) => syncUserGameStatsForUser(userId)),
      );
    } catch (error) {
      console.error(
        `[matches/${matchId}] disconnect forfeit stats sync failed:`,
        getErrorMessage(error),
      );
    }
  }

  if (result.kind === "forfeited") {
    return {
      gameUpdate: result.gameUpdate,
      kind: result.kind,
      matchId: result.matchId,
      stateVersion: result.stateVersion,
    };
  }

  return result;
}
