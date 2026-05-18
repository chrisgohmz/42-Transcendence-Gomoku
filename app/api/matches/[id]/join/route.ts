import { verifyPassword } from "better-auth/crypto";
import { z } from "zod";

import { Prisma } from "@/../generated/prisma/client";
import { MatchStatus, Role, Seat } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { getChallengeMatchMetadata } from "@/lib/matches/challenge-metadata";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { publishGameUpdate, publishQueueMatched } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";

const joinMatchRequestSchema = z.preprocess(
  (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}),
  z.object({
    displayName: z.string().trim().min(1).max(80).optional(),
    password: z.string().optional(),
  }),
);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function verifyMatchPassword(hash: string, password: string | undefined) {
  if (!password) {
    return false;
  }

  try {
    return await verifyPassword({ hash, password });
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json(
      {
        error: "unauthorized",
        message: "You need to sign in before joining a match.",
      },
      { status: 401 },
    );
  }

  try {
    const { id: matchId } = await params;
    const body = await request.json().catch(() => ({}));
    const validation = joinMatchRequestSchema.safeParse(body);

    if (!validation.success) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const displayName =
      validation.data.displayName ?? (context.user.displayName || context.user.username);

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });

    if (!match) {
      return Response.json({ error: "match_not_found" }, { status: 404 });
    }

    if (match.status !== MatchStatus.WAITING) {
      return Response.json({ error: "match_not_available" }, { status: 409 });
    }

    const challengeMetadata = getChallengeMatchMetadata(match.metadata);
    if (challengeMetadata && challengeMetadata.targetUserId !== context.user.id) {
      return Response.json({ error: "challenge_not_for_user" }, { status: 403 });
    }

    const alreadyJoined = match.participants.some(
      (participant) => participant.userId === context.user.id,
    );
    if (alreadyJoined) {
      return Response.json({ error: "already_in_match" }, { status: 409 });
    }

    const alreadyHasWhite = match.participants.some((p) => p.seat === Seat.WHITE);
    if (alreadyHasWhite) {
      return Response.json({ error: "match_full" }, { status: 409 });
    }

    if (match.password && !(await verifyMatchPassword(match.password, validation.data.password))) {
      return Response.json(
        { error: "invalid_password", message: "Incorrect password." },
        { status: 401 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const startedAt = new Date();
      const guardedTransition = await tx.match.updateMany({
        where: {
          id: matchId,
          stateVersion: match.stateVersion,
          status: MatchStatus.WAITING,
        },
        data: {
          stateVersion: {
            increment: 1,
          },
          status: MatchStatus.IN_PROGRESS,
          nextTurnSeat: Seat.BLACK,
          startedAt,
        },
      });

      if (guardedTransition.count !== 1) {
        return {
          kind: "error" as const,
          payload: { error: "match_not_available", status: 409 },
        };
      }

      const joiner = await tx.matchParticipant.create({
        data: {
          matchId,
          displayNameSnapshot: displayName,
          role: Role.PLAYER,
          seat: Seat.WHITE,
          userId: context.user.id,
        },
      });

      const updatedMatch = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          moves: {
            orderBy: { moveNumber: "asc" },
          },
          participants: {
            orderBy: { joinedAt: "asc" },
            include: {
              user: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!updatedMatch) {
        throw new Error("Joined match was not found.");
      }

      return {
        kind: "ok" as const,
        payload: { joiner, updatedMatch },
      };
    });

    if (result.kind === "error") {
      return Response.json({ error: result.payload.error }, { status: result.payload.status });
    }

    const { joiner, updatedMatch } = result.payload;
    const gameUpdate = buildGameUpdatePayload({
      match: updatedMatch,
      participants: updatedMatch.participants,
      moves: updatedMatch.moves,
    });

    try {
      const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);

      await publishGameUpdate(gameUpdate, timeoutMs);
      const creator = updatedMatch.participants.find((p) => p.id !== joiner.id);
      if (creator && creator.user?.username) {
        const session = {
          matchId: updatedMatch.id,
          participantId: creator.id,
          role: creator.role,
          seat: creator.seat,
          status: updatedMatch.status,
          displayName: creator.displayNameSnapshot,
          createdAt: updatedMatch.createdAt.toISOString(),
          startedAt: updatedMatch.startedAt?.toISOString() || null,
        };
        await publishQueueMatched(creator.user.username, session, timeoutMs);
      }
    } catch (publishError) {
      console.error(`[matches/${matchId}] realtime publish failed:`, getErrorMessage(publishError));
    }

    return Response.json({
      displayName: joiner.displayNameSnapshot,
      matchId,
      participantId: joiner.id,
      role: joiner.role,
      seat: joiner.seat,
      stateVersion: updatedMatch.stateVersion,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "match_full", detail: getErrorMessage(error) },
        { status: 409 },
      );
    }

    return Response.json(
      {
        error: "failed_to_join_match",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
