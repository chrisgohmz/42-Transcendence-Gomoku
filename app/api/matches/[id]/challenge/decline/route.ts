import { MatchResult, MatchStatus, MatchVisibility } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id: matchId } = await params;
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : null;

    if (!password) {
      return Response.json({ error: "missing_password" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
      },
    });

    if (!match) {
      return Response.json({ error: "match_not_found" }, { status: 404 });
    }

    if (
      match.status !== MatchStatus.WAITING ||
      match.visibility !== MatchVisibility.PRIVATE ||
      match.password !== password
    ) {
      return Response.json({ error: "challenge_not_cancellable" }, { status: 409 });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          endReason: "challenge_declined",
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

    return Response.json({ matchId, status: MatchStatus.CANCELLED });
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_decline_challenge",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
