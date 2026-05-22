import { getCurrentSession } from "@/lib/auth";
import { getLeaderboardSnapshot, type LeaderboardScope } from "@/lib/leaderboard";

function resolveScope(searchParams: URLSearchParams): LeaderboardScope {
  return searchParams.get("scope") === "friends" ? "friends" : "all";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(request?: Request) {
  try {
    const context = await getCurrentSession();
    const scope = resolveScope(
      new URL(request?.url ?? "http://localhost/api/leaderboard").searchParams,
    );
    const snapshot =
      scope === "friends"
        ? await getLeaderboardSnapshot(context?.user.id ?? null, { scope })
        : await getLeaderboardSnapshot(context?.user.id ?? null);

    return Response.json(snapshot);
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_load_leaderboard",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
