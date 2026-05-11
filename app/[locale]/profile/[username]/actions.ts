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
    const existing = await prisma.friendship.findUnique({
      where: { userLowId_userHighId: { userLowId, userHighId } },
    });

    if (action === "ADD") {
      if (existing) return { error: "Already friends or request pending" };

      await prisma.friendship.create({
        data: {
          userLowId,
          userHighId,
          requestedById: loggedInUserId,
          status: "PENDING",
        },
      });
    } else if (action === "ACCEPT") {
      if (!existing || existing.status !== "PENDING" || existing.requestedById === loggedInUserId) {
        return { error: "Invalid transition" };
      }

      await prisma.friendship.update({
        where: { userLowId_userHighId: { userLowId, userHighId } },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          respondedAt: new Date(),
        },
      });
    } else if (action === "DECLINE" || action === "REMOVE" || action === "CANCEL") {
      if (!existing) return { error: "Not found" };

      await prisma.friendship.delete({
        where: { userLowId_userHighId: { userLowId, userHighId } },
      });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { error: "Something went wrong." };
  }
}
