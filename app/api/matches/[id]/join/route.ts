import { z } from "zod";

import { Prisma } from "@/../generated/prisma/client";
import { MatchStatus, Role, Seat } from "@/../generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const joinMatchRequestSchema = z.preprocess(
  (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}),
  z.object({
    displayName: z.string().trim().min(1).max(80).optional(),
  }),
);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: matchId } = await params;
    const body = await request.json().catch(() => ({}));
    const validation = joinMatchRequestSchema.safeParse(body);

    if (!validation.success) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

    const displayName = validation.data.displayName ?? "Player 2";

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

    const alreadyHasWhite = match.participants.some((p) => p.seat === Seat.WHITE);
    if (alreadyHasWhite) {
      return Response.json({ error: "match_full" }, { status: 409 });
    }

    const { joiner } = await prisma.$transaction(async (tx) => {
      const joiner = await tx.matchParticipant.create({
        data: {
          matchId,
          displayNameSnapshot: displayName,
          role: Role.PLAYER,
          seat: Seat.WHITE,
        },
      });

      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.IN_PROGRESS,
          nextTurnSeat: Seat.BLACK,
          startedAt: new Date(),
        },
      });

      return { joiner };
    });

    return Response.json({
      matchId,
      participantId: joiner.id,
      role: joiner.role,
      seat: joiner.seat,
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
