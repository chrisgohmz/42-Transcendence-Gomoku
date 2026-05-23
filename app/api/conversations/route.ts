// This file handles: GET /api/conversations
//
// Returns all DM conversations for the logged-in user, including:
//   - the other person's name and username
//   - the last message preview
//   - the unread message count
//
// browser calls this once when the messages page loads.

import { getErrorMessage } from "@/lib/api-errors";
import { getCurrentSession } from "@/lib/auth";
import { sortFriendshipKey } from "@/lib/chat/access";
import { prisma } from "@/lib/prisma";

// crashwith cacheComponents
// export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Make sure the user is logged in
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id;

  try {
    // 2. Find DIRECT conversations where this user is a participant.
    //    Non-DIRECT (e.g. match chat) is intentionally excluded — the
    //    messages page only renders friend DMs.
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId: currentUserId,
        conversation: { kind: "DIRECT" },
      },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        conversation: { lastMessageAt: "desc" },
      },
    });

    type Participation = (typeof participations)[number];
    type ParticipantOfConversation = Participation["conversation"]["participants"][number];

    function otherParticipantOf(p: Participation): ParticipantOfConversation | undefined {
      return p.conversation.participants.find(
        (cp: ParticipantOfConversation) => cp.userId !== currentUserId,
      );
    }

    // 3. Filter out conversations whose other user is no longer an accepted friend.
    const otherUserIds = participations
      .map((p: Participation) => otherParticipantOf(p)?.userId)
      .filter((id: string | undefined): id is string => typeof id === "string");

    const friendshipKeys = otherUserIds.map((otherId: string) =>
      sortFriendshipKey(currentUserId, otherId),
    );
    const friendships = friendshipKeys.length
      ? await prisma.friendship.findMany({
          where: {
            OR: friendshipKeys,
            status: "ACCEPTED",
          },
          select: { userLowId: true, userHighId: true },
        })
      : [];
    const acceptedFriendIds = new Set<string>();
    for (const f of friendships) {
      const other = f.userLowId === currentUserId ? f.userHighId : f.userLowId;
      acceptedFriendIds.add(other);
    }

    // 4. Shape the data into something clean for the frontend
    const allowedParticipations = participations.filter((p: Participation) => {
      const other = otherParticipantOf(p);
      return other ? acceptedFriendIds.has(other.userId) : false;
    });

    const conversations = await Promise.all(
      allowedParticipations.map(async (participation: Participation) => {
        const conv = participation.conversation;
        const otherParticipant = otherParticipantOf(participation);

        const unreadCount = await prisma.directMessage.count({
          where: {
            conversationId: conv.id,
            deletedAt: null,
            senderUserId: { not: currentUserId },
            createdAt: participation.lastReadAt ? { gt: participation.lastReadAt } : undefined,
          },
        });

        return {
          id: conv.id,
          otherUser: otherParticipant?.user ?? null,
          lastMessage: conv.messages[0]?.body ?? null,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
        };
      }),
    );

    return Response.json({ conversations });
  } catch (error) {
    return Response.json(
      { error: "failed_to_load_conversations", detail: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
