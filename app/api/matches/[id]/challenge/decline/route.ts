import { verifyPassword } from "better-auth/crypto";

import { MatchResult, MatchStatus, MatchVisibility } from "@/../generated/prisma/enums";
import { getCurrentSession } from "@/lib/auth";
import { getChallengeMatchMetadata } from "@/lib/matches/challenge-metadata";
import { publishChallengeDeclined } from "@/lib/matches/realtime-publisher";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";
import { enforceMutationRequest } from "@/lib/request-security";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function verifyDeclineToken(hash: string, token: string) {
  if (!token) {
    return false;
  }

  try {
    return await verifyPassword({ hash, password: token });
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestGuardResponse = enforceMutationRequest(request, { requireJson: true });

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const context = await getCurrentSession();

  if (!context) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id: matchId } = await params;
    const bodyValue = await request.json().catch(() => ({}));
    const body =
      typeof bodyValue === "object" && bodyValue !== null && !Array.isArray(bodyValue)
        ? bodyValue
        : {};
    const declineToken = typeof body.declineToken === "string" ? body.declineToken : "";

    if (!declineToken) {
      return Response.json({ error: "missing_decline_token" }, { status: 400 });
    }

    const rateLimitExceededResponse = await enforceRateLimit(
      request.headers,
      rateLimitRule("matchChallengeDecline", userRateLimitSubject(context.user.id)),
    );

    if (rateLimitExceededResponse) {
      return rateLimitExceededResponse;
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
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

    if (!match) {
      return Response.json({ error: "match_not_found" }, { status: 404 });
    }

    const challengeMetadata = getChallengeMatchMetadata(match.metadata);

    if (
      match.status !== MatchStatus.WAITING ||
      match.visibility !== MatchVisibility.PRIVATE ||
      !challengeMetadata ||
      challengeMetadata.targetUserId !== context.user.id ||
      !(await verifyDeclineToken(challengeMetadata.declineTokenHash, declineToken))
    ) {
      return Response.json({ error: "challenge_not_cancellable" }, { status: 409 });
    }

    const creator = match.participants.find(
      (participant) => participant.userId === match.createdByUserId,
    );
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

    if (creator?.user?.username) {
      try {
        const timeoutMs = Number(process.env["REALTIME_PUBLISH_TIMEOUT_MS"] ?? 2000);
        await publishChallengeDeclined(
          creator.user.username,
          {
            matchId,
            senderUsername: context.user.username,
          },
          timeoutMs,
        );
      } catch (publishError) {
        console.error(
          `[matches/${matchId}] challenge decline publish failed:`,
          getErrorMessage(publishError),
        );
      }
    }

    return Response.json({ matchId, status: MatchStatus.CANCELLED });
  } catch (error) {
    console.error("[api/matches/challenge/decline] failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_decline_challenge",
      },
      { status: 500 },
    );
  }
}
