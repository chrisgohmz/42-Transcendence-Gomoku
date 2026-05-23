// GET /api/friends
// Returns the list of accepted friends for the current user.
// Used by the messages sidebar to show all friends, not just those with existing conversations.

import { getErrorMessage } from "@/lib/api-errors";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ userLowId: session.user.id }, { userHighId: session.user.id }],
      },
      include: {
        userLow: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        userHigh: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // For each friendship, return the OTHER user (not the current user)
    const friends = friendships.map((f) => {
      const other = f.userLowId === session.user.id ? f.userHigh : f.userLow;
      return {
        id: other.id,
        username: other.username,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
      };
    });

    return Response.json({ friends });
  } catch (error) {
    return Response.json(
      { error: "failed_to_load_friends", detail: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
