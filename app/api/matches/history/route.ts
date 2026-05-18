import { getCurrentSession } from "@/lib/auth";
import {
  MATCH_HISTORY_MAX_LIMIT,
  getMatchHistoryForUser,
  normalizeMatchHistoryLimit,
} from "@/lib/matches/match-history";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function parseLimit(request: Request): number | null {
  const rawLimit = new URL(request.url).searchParams.get("limit");

  if (rawLimit === null) {
    return normalizeMatchHistoryLimit(null);
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MATCH_HISTORY_MAX_LIMIT) {
    return null;
  }

  return limit;
}

export async function GET(request: Request) {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json(
      {
        error: "unauthorized",
        message: "You need to sign in before viewing match history.",
      },
      { status: 401 },
    );
  }

  const limit = parseLimit(request);
  if (limit === null) {
    return Response.json(
      {
        error: "invalid_limit",
        message: `Limit must be an integer between 1 and ${MATCH_HISTORY_MAX_LIMIT}.`,
      },
      { status: 400 },
    );
  }

  try {
    const matches = await getMatchHistoryForUser(context.user.id, limit);

    return Response.json({
      count: matches.length,
      limit,
      matches,
    });
  } catch (error) {
    return Response.json(
      {
        detail: getErrorMessage(error),
        error: "failed_to_load_match_history",
      },
      { status: 500 },
    );
  }
}
