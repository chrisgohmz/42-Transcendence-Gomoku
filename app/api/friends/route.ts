// GET /api/friends
// Returns the list of accepted friends for the current user.
// Used by the messages sidebar to show all friends, not just those with existing conversations.

import { getErrorMessage } from "@/lib/api-errors";
import { getCurrentSession } from "@/lib/auth";
import {
  acceptedFriendshipWhere,
  getOtherFriendshipUser,
} from "@/lib/friendships/friendship-queries";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const friendships = await prisma.friendship.findMany({
      where: acceptedFriendshipWhere(session.user.id),
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
      const other = getOtherFriendshipUser(f, session.user.id);
      return {
        id: other.id,
        username: other.username,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
      };
    });

    return Response.json({ friends });
  } catch (error) {
    console.error("[api/friends] load failed:", getErrorMessage(error));
    return Response.json({ error: "failed_to_load_friends" }, { status: 500 });
  }
}
