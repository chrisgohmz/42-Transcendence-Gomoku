import { getCurrentSession } from "@/lib/auth";
import { getProfileStatsForUser } from "@/lib/stats/profile-stats";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json(
      {
        error: "unauthorized",
        message: "You need to sign in before viewing profile stats.",
      },
      { status: 401 },
    );
  }

  try {
    const snapshot = await getProfileStatsForUser(context.user.id);

    return Response.json(snapshot);
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_load_profile_stats",
        detail: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
