"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth";
import {
  deleteFriendshipAndNotify,
  getLowHighIds,
  notifyFriendshipUpdateForUserIdsSafely,
} from "@/lib/friendships/friendship-mutations";
import { prisma } from "@/lib/prisma";

export async function sendFriendRequest(targetUsername: string) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "friends" });
  const session = await getCurrentSession();
  if (!session) return { error: t("actions.signInToAddFriends") };

  const targetUser = await prisma.user.findUnique({
    where: { username: targetUsername },
  });

  if (!targetUser) return { error: t("actions.playerNotFound") };
  if (targetUser.id === session.user.id) return { error: t("actions.cannotAddYourself") };

  const { userLowId, userHighId } = getLowHighIds(session.user.id, targetUser.id);

  const existing = await prisma.friendship.findUnique({
    where: { userLowId_userHighId: { userLowId, userHighId } },
  });

  if (existing) {
    return { error: t("actions.alreadyFriendsOrPending") };
  }

  await prisma.friendship.create({
    data: {
      userLowId,
      userHighId,
      requestedById: session.user.id,
      status: "PENDING",
    },
  });
  await notifyFriendshipUpdateForUserIdsSafely(userLowId, userHighId);

  revalidatePath("/", "layout");
  return { success: true };
}

export async function respondToRequest(friendshipId: number, accept: boolean) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "friends" });
  const session = await getCurrentSession();
  if (!session) return { error: t("actions.signIn") };

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!friendship) return { error: t("actions.requestNotFound") };
  if (friendship.userLowId !== session.user.id && friendship.userHighId !== session.user.id) {
    return { error: t("actions.unauthorized") };
  }
  if (accept) {
    if (friendship.status !== "PENDING" || friendship.requestedById === session.user.id) {
      return { error: t("actions.invalidTransition") };
    }
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        respondedAt: new Date(),
      },
    });
    await notifyFriendshipUpdateForUserIdsSafely(friendship.userLowId, friendship.userHighId);
  } else {
    await deleteFriendshipAndNotify(friendship);
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeFriend(friendshipId: number) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "friends" });
  const session = await getCurrentSession();
  if (!session) return { error: t("actions.signIn") };
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!friendship) return { error: t("actions.friendshipNotFound") };
  if (friendship.userLowId !== session.user.id && friendship.userHighId !== session.user.id) {
    return { error: t("actions.unauthorized") };
  }
  await deleteFriendshipAndNotify(friendship);

  revalidatePath("/", "layout");
  return { success: true };
}
