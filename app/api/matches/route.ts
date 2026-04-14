import { prisma } from "../../lib/prisma";
import { getCurrentSession } from "../../lib/auth";
import { Role, MatchStatus, Seat } from "../../../generated/prisma/enums";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST() {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json(
      {
        error: "unauthorized",
        message: "You need to sign in before creating a match.",
      },
      { status: 401 },
    );
  }

  try {
    const match = await prisma.match.create({
      data: {
        participants: {
          create: {
            displayNameSnapshot: "Player 1",
            role: Role.PLAYER,
            seat: Seat.BLACK,
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

    return Response.json({
      matchId: match.id,
      participantId: creator.id,
      role: creator.role,
      seat: creator.seat,
      status: match.status,
      createdAt: match.createdAt,
    });
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_create_match",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.WAITING },
    orderBy: { createdAt: "desc" },
    include: {
      participants: true,
    },
  });

  const body = matches.map((r) => ({
    matchId: r.id,
    status: r.status,
    ruleType: r.ruleType,
    boardSize: r.boardSize,
    createdAt: r.createdAt,
    participants: r.participants.map((p) => ({
      displayName: p.displayNameSnapshot,
      seat: p.seat,
    })),
  }));

  return Response.json(body);
}
