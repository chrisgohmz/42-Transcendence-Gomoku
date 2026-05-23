import { prisma as defaultPrisma } from "@/lib/prisma";

import { sortFriendshipKey } from "./access";

type UnreadDirectMessageStore = {
  conversationParticipant: {
    findMany: typeof defaultPrisma.conversationParticipant.findMany;
  };
  directMessage: {
    count: typeof defaultPrisma.directMessage.count;
  };
  friendship: {
    findMany: typeof defaultPrisma.friendship.findMany;
  };
};

export async function getUnreadDirectMessageCountForUser(
  currentUserId: string,
  db: UnreadDirectMessageStore = defaultPrisma,
): Promise<number> {
  const participations = await db.conversationParticipant.findMany({
    where: {
      userId: currentUserId,
      conversation: { kind: "DIRECT" },
    },
    select: {
      conversationId: true,
      lastReadAt: true,
      conversation: {
        select: {
          participants: {
            where: { userId: { not: currentUserId } },
            select: { userId: true },
          },
        },
      },
    },
  });

  const otherUserIds = participations
    .map((participation) => participation.conversation.participants[0]?.userId)
    .filter((id): id is string => typeof id === "string");

  if (otherUserIds.length === 0) {
    return 0;
  }

  const friendships = await db.friendship.findMany({
    where: {
      OR: otherUserIds.map((otherId) => sortFriendshipKey(currentUserId, otherId)),
      status: "ACCEPTED",
    },
    select: { userLowId: true, userHighId: true },
  });
  const acceptedFriendIds = new Set<string>();

  for (const friendship of friendships) {
    acceptedFriendIds.add(
      friendship.userLowId === currentUserId ? friendship.userHighId : friendship.userLowId,
    );
  }

  const unreadConversationFilters = participations.flatMap((participation) => {
    const otherUserId = participation.conversation.participants[0]?.userId;

    if (!otherUserId || !acceptedFriendIds.has(otherUserId)) {
      return [];
    }

    return [
      {
        conversationId: participation.conversationId,
        deletedAt: null,
        senderUserId: { not: currentUserId },
        createdAt: participation.lastReadAt ? { gt: participation.lastReadAt } : undefined,
      },
    ];
  });

  if (unreadConversationFilters.length === 0) {
    return 0;
  }

  return db.directMessage.count({
    where: { OR: unreadConversationFilters },
  });
}
