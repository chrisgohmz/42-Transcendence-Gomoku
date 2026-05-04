"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function processFriendAction(
  targetUserId: string,
  action: "ADD" | "ACCEPT" | "DECLINE" | "REMOVE" | "CANCEL",
) {
  const session = await getCurrentSession();
  const loggedInUserId = session?.user?.id;

  if (!loggedInUserId) {
    return { error: "Unauthorized" };
  }

  const userLowId = loggedInUserId < targetUserId ? loggedInUserId : targetUserId;
  const userHighId = loggedInUserId < targetUserId ? targetUserId : loggedInUserId;

  try {
    if (action === "ADD") {
      await prisma.friendship.create({
        data: {
          userLowId,
          userHighId,
          requestedById: loggedInUserId,
          status: "PENDING",
        },
      });
    }

    if (action === "ACCEPT") {
      await prisma.friendship.update({
        where: { userLowId_userHighId: { userLowId, userHighId } },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          respondedAt: new Date(),
        },
      });
    }

    if (action === "DECLINE") {
      await prisma.friendship.delete({
        where: { userLowId_userHighId: { userLowId, userHighId } },
      });
    }

    if (action === "REMOVE" || action === "CANCEL") {
      await prisma.friendship.delete({
        where: { userLowId_userHighId: { userLowId, userHighId } },
      });
    }

    revalidatePath("/[locale]/profile/[username]", "page");
    return { success: true };
  } catch {
    return { error: "Something went wrong." };
  }
}
