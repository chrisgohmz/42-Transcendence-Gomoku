import { parseMatchHistorySearchParams } from "@/lib/advanced-search";
import { getCurrentSession } from "@/lib/auth";
import {
  MATCH_HISTORY_MAX_LIMIT,
  getMatchHistoryPageForUser,
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

function parsePage(request: Request): number {
  const rawPage = new URL(request.url).searchParams.get("page");
  const page = Number(rawPage);
  return Number.isInteger(page) && page > 0 ? page : 1;
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
    const query = parseMatchHistorySearchParams(new URL(request.url).searchParams);
    const page = parsePage(request);
    const history = await getMatchHistoryPageForUser(context.user.id, page, limit, {
      ...query,
      limit,
      page,
    });

    return Response.json({
      count: history.entries.length,
      limit,
      matches: history.entries,
      page: history.page,
      totalMatches: history.totalMatches,
      totalPages: history.totalPages,
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
