import { prisma } from "../../../lib/prisma";
import { getCurrentSession } from "../../../lib/auth";
import { MatchStatus, Role, Seat } from "../../../generated/prisma/enums";

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
        message: "You need to sign in before creating a room.",
      },
      { status: 401 },
    );
  }

  try {
    const match = await prisma.match.create({
      data: {
        createdByUserId: context.user.id,
        participants: {
          create: [
            {
              userId: context.user.id,
              displayNameSnapshot: context.user.displayName,
              role: Role.PLAYER,
              seat: Seat.BLACK,
            },
          ],
        },
      },
    });
    return Response.json({
      id: match.id,
      status: match.status,
      createdAt: match.createdAt,
    });
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_create_room",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const rooms = await prisma.match.findMany({
    where: { status: MatchStatus.WAITING },
    orderBy: { createdAt: "desc" },
    include: {
      participants: true,
    },
  });

  const body = rooms.map((r) => ({
    id: r.id,
    status: r.status,
    ruleType: r.ruleType,
    boardSize: r.boardSize,
    createdAt: r.createdAt,
    players: r.participants.map((p) => ({
      displayName: p.displayNameSnapshot,
      seat: p.seat,
    })),
  }));

  return Response.json(body);
}
