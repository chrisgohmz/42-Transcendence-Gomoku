import { parseLeaderboardSearchParams } from "@/lib/advanced-search";
import { getCurrentSessionIdentity } from "@/lib/auth";
import { getLeaderboardSearchSnapshot } from "@/lib/leaderboard";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(request?: Request) {
  try {
    const context = await getCurrentSessionIdentity();
    const query = parseLeaderboardSearchParams(
      new URL(request?.url ?? "http://localhost/api/leaderboard").searchParams,
    );
    const snapshot = await getLeaderboardSearchSnapshot(context?.user.id ?? null, query);

    return Response.json(snapshot);
  } catch (error) {
    console.error("[api/leaderboard] load failed:", getErrorMessage(error));
    return Response.json(
      {
        error: "failed_to_load_leaderboard",
      },
      { status: 500 },
    );
  }
}
