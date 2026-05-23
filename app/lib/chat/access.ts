// Shared authorization helpers for direct-message conversations.
//
// The friends-only DM rule must hold across every entry point: creation,
// listing, message read/send, and socket subscription. Keeping the policy
// in one module avoids the drift the PR review flagged across REST/Socket.

import { prisma as defaultPrisma } from "@/lib/prisma";

type FriendshipStore = {
  friendship: {
    findUnique: typeof defaultPrisma.friendship.findUnique;
  };
};

type ConversationStore = {
  conversation: {
    findUnique: typeof defaultPrisma.conversation.findUnique;
  };
  conversationParticipant: {
    findUnique: typeof defaultPrisma.conversationParticipant.findUnique;
  };
};

export type DirectMessageAccessStore = FriendshipStore & ConversationStore;

export function sortFriendshipKey(a: string, b: string): { userLowId: string; userHighId: string } {
  const [low, high] = [a, b].sort();
  return { userLowId: low!, userHighId: high! };
}

export async function isAcceptedFriend(
  currentUserId: string,
  otherUserId: string,
  db: FriendshipStore = defaultPrisma,
): Promise<boolean> {
  if (currentUserId === otherUserId) return false;
  const friendship = await db.friendship.findUnique({
    where: { userLowId_userHighId: sortFriendshipKey(currentUserId, otherUserId) },
    select: { status: true },
  });
  return friendship?.status === "ACCEPTED";
}

export type DirectConversationAccessResult =
  | { allowed: true; otherUserId: string }
  | { allowed: false; reason: "not_found" | "not_friends" | "not_direct" };

// Confirms the user can read/send in a direct conversation.
// Requires (1) participation, (2) DIRECT kind, (3) an accepted friendship
// with the other participant. Non-DIRECT conversations are intentionally
// rejected here — match/group chat must go through their own access guards.
export async function canAccessDirectConversation(
  currentUserId: string,
  conversationId: string,
  db: DirectMessageAccessStore = defaultPrisma,
): Promise<DirectConversationAccessResult> {
  const participation = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: currentUserId } },
    select: { id: true },
  });
  if (!participation) return { allowed: false, reason: "not_found" };

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      kind: true,
      participants: {
        where: { userId: { not: currentUserId } },
        select: { userId: true },
      },
    },
  });
  if (!conversation) return { allowed: false, reason: "not_found" };

  if (conversation.kind !== "DIRECT") {
    return { allowed: false, reason: "not_direct" };
  }

  const otherId = conversation.participants[0]?.userId;
  if (!otherId) return { allowed: false, reason: "not_friends" };

  const friendly = await isAcceptedFriend(currentUserId, otherId, db);
  if (!friendly) return { allowed: false, reason: "not_friends" };

  return { allowed: true, otherUserId: otherId };
}
