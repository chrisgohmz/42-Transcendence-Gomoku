import { prisma as defaultPrisma } from "@/lib/prisma";

type ReadStateStore = {
  conversationParticipant: {
    update: typeof defaultPrisma.conversationParticipant.update;
  };
};

export async function markDirectConversationRead(
  conversationId: string,
  userId: string,
  db: ReadStateStore = defaultPrisma,
): Promise<Date> {
  const lastReadAt = new Date();

  await db.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    data: { lastReadAt },
  });

  return lastReadAt;
}
