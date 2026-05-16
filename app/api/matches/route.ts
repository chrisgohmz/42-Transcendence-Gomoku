import { Role, MatchStatus, Seat, MatchVisibility } from "../../../generated/prisma/enums";
import { getCurrentSession } from "../../lib/auth";
import { buildGameUpdatePayload } from "../../lib/matches/game-update";
import { cleanupStaleMatchSessions } from "../../lib/matches/matchmaking";
import { standardGomokuBoardSize } from "../../lib/matches/move-rules";
import { publishGameUpdate } from "../../lib/matches/realtime-publisher";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request) {
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
    const body = await request.json().catch(() => ({}));
    const name =
      typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;
    const password =
      typeof body.password === "string" && body.password.length > 0 ? body.password : null;
    const visibility =
      body.visibility === MatchVisibility.PRIVATE
        ? MatchVisibility.PRIVATE
        : MatchVisibility.PUBLIC;

    const match = await prisma.match.create({
      data: {
        name,
        password,
        boardSize: standardGomokuBoardSize,
        createdByUserId: context.user.id,
        visibility,
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

    const gameUpdate = buildGameUpdatePayload({
      match,
      participants: match.participants,
      moves: [],
    });

    try {
      const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);
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
        error: "failed_to_create_match",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  await cleanupStaleMatchSessions();

  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.WAITING,
      visibility: MatchVisibility.PUBLIC,
    },
    orderBy: { createdAt: "desc" },
    include: {
      participants: true,
    },
  });

  const body = matches.map((r) => ({
    matchId: r.id,
    name: r.name,
    requiresPassword: r.password !== null,
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
