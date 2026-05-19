import { getCurrentSession } from "@/lib/auth";
import { getProfileStatsForUser } from "@/lib/stats/profile-stats";

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
    console.error("Error loading profile stats:", error);

    return Response.json(
      {
        error: "failed_to_load_profile_stats",
      },
      { status: 500 },
    );
  }
}
