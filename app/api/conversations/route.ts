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
import { prisma } from "@/lib/prisma";

// crashwith cacheComponents
// export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Make sure the user is logged in
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 2. Find all conversations where this user is a participant
    //    We use `include` to also fetch related data in the same query
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        conversation: {
          include: {
            // Fetch ALL participants of each conversation so we can find the "other" user
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
            // Fetch the most recent message for the preview
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        // Show conversations with the most recent activity first
        conversation: { lastMessageAt: "desc" },
      },
    });

    // 3. Shape the data into something clean for the frontend
    const conversations = await Promise.all(
      participations.map(async (participation) => {
        const conv = participation.conversation;

        // Find the other participant (not the current user)
        const otherParticipant = conv.participants.find((p) => p.userId !== session.user.id);

        // Count unread messages:
        // messages created AFTER the last time the current user read this conversation

        const unreadCount = await prisma.directMessage.count({
          where: {
            conversationId: conv.id,
            deletedAt: null,
            senderUserId: { not: session.user.id }, // don't count own messages
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
      }), //closes map
    ); //closes Promise.all

    return Response.json({ conversations });
  } catch (error) {
    return Response.json(
      { error: "failed_to_load_conversations", detail: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
