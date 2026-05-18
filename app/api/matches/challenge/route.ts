import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import {
  FriendshipStatus,
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  Seat,
} from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { createChallengeMatchMetadata } from "@/lib/matches/challenge-metadata";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { standardGomokuBoardSize } from "@/lib/matches/move-rules";
import { publishChallengeReceived, publishGameUpdate } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getOptionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getLowHighIds(id1: string, id2: string) {
  return id1 < id2 ? { userLowId: id1, userHighId: id2 } : { userLowId: id2, userHighId: id1 };
}

async function cancelUndeliveredChallenge(matchId: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.match.updateMany({
      where: {
        id: matchId,
        status: MatchStatus.WAITING,
      },
      data: {
        endReason: "challenge_invite_failed",
        finishedAt: now,
        nextTurnSeat: null,
        status: MatchStatus.CANCELLED,
      },
    });

    await tx.matchParticipant.updateMany({
      where: {
        leftAt: null,
        matchId,
        result: null,
      },
      data: {
        leftAt: now,
        result: MatchResult.CANCELLED,
      },
    });
  });
}

export async function POST(request: Request) {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json(
      {
        error: "unauthorized",
        message: "You need to sign in before creating a challenge.",
      },
      { status: 401 },
    );
  }

  try {
    const bodyValue = await request.json().catch(() => ({}));
    const body =
      typeof bodyValue === "object" && bodyValue !== null && !Array.isArray(bodyValue)
        ? bodyValue
        : {};
    const targetUsername = getOptionalTrimmedString(body.targetUsername);
    const name =
      getOptionalTrimmedString(body.name) ??
      `${context.user.username} vs ${targetUsername ?? "opponent"}`;

    if (!targetUsername) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { username: targetUsername },
      select: {
        id: true,
        username: true,
      },
    });

    if (!target) {
      return Response.json({ error: "target_not_found" }, { status: 404 });
    }

    if (target.id === context.user.id) {
      return Response.json({ error: "cannot_challenge_self" }, { status: 400 });
    }

    const friendship = await prisma.friendship.findUnique({
      where: {
        userLowId_userHighId: getLowHighIds(context.user.id, target.id),
      },
      select: {
        status: true,
      },
    });

    if (!friendship || friendship.status !== FriendshipStatus.ACCEPTED) {
      return Response.json({ error: "target_not_challengeable" }, { status: 403 });
    }

    const roomPassword = randomUUID();
    const declineToken = randomUUID();
    const [hashedPassword, declineTokenHash] = await Promise.all([
      hashPassword(roomPassword),
      hashPassword(declineToken),
    ]);

    const match = await prisma.match.create({
      data: {
        name,
        password: hashedPassword,
        boardSize: standardGomokuBoardSize,
        createdByUserId: context.user.id,
        metadata: createChallengeMatchMetadata({
          declineTokenHash,
          targetUserId: target.id,
          targetUsername: target.username,
        }),
        visibility: MatchVisibility.PRIVATE,
        participants: {
          create: {
            displayNameSnapshot: context.user.displayName || context.user.username,
            role: Role.PLAYER,
            seat: Seat.BLACK,
            userId: context.user.id,
          },
        },
      },
      include: {
        participants: true,
      },
    });
    const creator = match.participants[0];

    if (!creator) {
      throw new Error("Match participant was not created.");
    }

    const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);
    const gameUpdate = buildGameUpdatePayload({
      match,
      participants: match.participants,
      moves: [],
    });

    try {
      await publishChallengeReceived(
        target.username,
        {
          declineToken,
          matchId: match.id,
          password: roomPassword,
          senderUsername: context.user.username,
        },
        timeoutMs,
      );
    } catch (publishError) {
      console.error(
        `[matches/${match.id}] challenge invite publish failed:`,
        getErrorMessage(publishError),
      );

      await cancelUndeliveredChallenge(match.id);

      return Response.json(
        {
          error: "failed_to_deliver_challenge",
          detail: getErrorMessage(publishError),
        },
        { status: 502 },
      );
    }

    try {
      await publishGameUpdate(gameUpdate, timeoutMs);
    } catch (publishError) {
      console.error(
        `[matches/${match.id}] realtime publish failed:`,
        getErrorMessage(publishError),
      );
    }

    return Response.json({
      displayName: creator.displayNameSnapshot,
      matchId: match.id,
      participantId: creator.id,
      role: creator.role,
      seat: creator.seat,
      stateVersion: match.stateVersion,
      status: match.status,
      createdAt: match.createdAt,
    });
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_create_challenge",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
