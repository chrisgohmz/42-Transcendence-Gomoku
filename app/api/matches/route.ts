import { hashPassword } from "better-auth/crypto";

import { Role, MatchStatus, Seat, MatchVisibility } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { getChallengeMatchMetadata } from "@/lib/matches/challenge-metadata";
import { buildGameUpdatePayload } from "@/lib/matches/game-update";
import { standardGomokuBoardSize } from "@/lib/matches/move-rules";
import { publishGameUpdate } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

const maxRoomNameLength = 80;
const maxRoomPasswordLength = 128;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getOptionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isLobbyListedMatch({
  metadata,
  visibility,
}: {
  metadata: unknown;
  visibility: MatchVisibility;
}) {
  return visibility === MatchVisibility.PUBLIC || !getChallengeMatchMetadata(metadata);
}

export async function POST(request: Request) {
  const requestGuardResponse = enforceMutationRequest(request, { requireJson: true });

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

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
    const bodyValue = await request.json().catch(() => ({}));

    const body =
      typeof bodyValue === "object" && bodyValue !== null && !Array.isArray(bodyValue)
        ? bodyValue
        : {};

    const name = getOptionalTrimmedString(body.name);

    const rawPassword = getOptionalTrimmedString(body.password);

    const visibility =
      body.visibility === MatchVisibility.PRIVATE
        ? MatchVisibility.PRIVATE
        : MatchVisibility.PUBLIC;

    if (name && name.length > maxRoomNameLength) {
      return Response.json(
        {
          error: "room_name_too_long",
          message: "Room names must be 80 characters or fewer.",
        },
        { status: 400 },
      );
    }

    if (rawPassword && rawPassword.length > maxRoomPasswordLength) {
      return Response.json(
        {
          error: "room_password_too_long",
          message: "Room passwords must be 128 characters or fewer.",
        },
        { status: 400 },
      );
    }

    const rateLimitExceededResponse = await enforceRateLimit(
      request.headers,
      rateLimitRule("matchCreate", userRateLimitSubject(context.user.id)),
    );

    if (rateLimitExceededResponse) {
      return rateLimitExceededResponse;
    }

    if (visibility === MatchVisibility.PRIVATE && !rawPassword) {
      return Response.json(
        {
          error: "private_room_password_required",
          message: "Private rooms require a password.",
        },
        { status: 400 },
      );
    }

    const password =
      visibility === MatchVisibility.PRIVATE && rawPassword
        ? await hashPassword(rawPassword)
        : null;

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
      match: {
        ...match,
        metadata: match.metadata ?? null,
      },
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
    console.error("[api/matches] create failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_create_match",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { cleanupStaleMatchSessions } = await import("@/lib/matches/matchmaking");

  await cleanupStaleMatchSessions();

  const { searchParams } = new URL(request.url);

  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);

  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 50);

  const allWaitingMatches = await prisma.match.findMany({
    where: {
      status: MatchStatus.WAITING,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      participants: true,
    },
  });

  const listedMatches = allWaitingMatches.filter(isLobbyListedMatch);
  const totalMatches = listedMatches.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / limit));
  const offset = (page - 1) * limit;
  const matches = listedMatches.slice(offset, offset + limit);

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

  return Response.json({
    data: body,
    page,
    limit,
    totalMatches,
    totalPages,
  });
}
