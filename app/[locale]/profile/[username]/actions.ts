"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getCurrentSession } from "@/lib/auth";
import {
  deleteFriendshipAndNotify,
  getLowHighIds,
  notifyFriendshipUpdateForUserIdsSafely,
} from "@/lib/friendships/friendship-mutations";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";

export async function processFriendAction(
  targetUserId: string,
  action: "ADD" | "ACCEPT" | "DECLINE" | "REMOVE" | "CANCEL",
) {
  const session = await getCurrentSession();
  const loggedInUserId = session?.user?.id;

  if (!loggedInUserId) {
    return { error: "Unauthorized" };
  }

  const rateLimitExceeded = await isRateLimited(
    await headers(),
    rateLimitRule("profileFriendAction", userRateLimitSubject(loggedInUserId)),
  );

  if (rateLimitExceeded) {
    return { error: "Too many requests. Please try again later." };
  }

  const { userLowId, userHighId } = getLowHighIds(loggedInUserId, targetUserId);

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
      await notifyFriendshipUpdateForUserIdsSafely(userLowId, userHighId);
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
      await notifyFriendshipUpdateForUserIdsSafely(userLowId, userHighId);
    } else if (action === "DECLINE" || action === "REMOVE" || action === "CANCEL") {
      if (!existing) return { error: "Not found" };

      await deleteFriendshipAndNotify(existing);
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { error: "Something went wrong." };
  }
}
