import { parseMatchHistorySearchParams } from "@/lib/advanced-search";
import { getCurrentSession } from "@/lib/auth";
import { getProfileStatsForUser } from "@/lib/stats/profile-stats";

export async function GET(request: Request = new Request("http://localhost/api/profile/stats")) {
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
    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
    const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 50);
    const recentMatchesSearch = parseMatchHistorySearchParams(searchParams);

    const snapshot = await getProfileStatsForUser(context.user.id, {
      recentMatchesLimit: limit,
      recentMatchesPage: page,
      recentMatchesSearch: {
        ...recentMatchesSearch,
        limit,
        page,
      },
    });

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
