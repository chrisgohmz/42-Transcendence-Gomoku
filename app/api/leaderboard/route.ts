import { getCurrentSession } from "@/lib/auth";
import { getLeaderboardSnapshot } from "@/lib/leaderboard";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  try {
    const context = await getCurrentSession();
    const snapshot = await getLeaderboardSnapshot(context?.user.id ?? null);

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
