"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getLowHighIds(id1: string, id2: string) {
  return id1 < id2 ? { userLowId: id1, userHighId: id2 } : { userLowId: id2, userHighId: id1 };
}

async function notifyFriendshipUpdate(userLowId: string, userHighId: string) {
  try {
    const userLow = await prisma.user.findUnique({ where: { id: userLowId } });
    const userHigh = await prisma.user.findUnique({ where: { id: userHighId } });

    if (!userLow || !userHigh) return;

    const socketUrl = process.env["REALTIME_INTERNAL_URL"]
      ? process.env["REALTIME_INTERNAL_URL"].replace("/game-update", "/friendship-update")
      : "http://realtime:3001/internal/friendship-update";

    await fetch(socketUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [userLow.username, userHigh.username] }),
    });
  } catch (err) {
    console.error("Failed to notify realtime server", err);
  }
}

export async function sendFriendRequest(targetUsername: string) {
  const session = await getCurrentSession();
  if (!session) return { error: "Please sign in to add friends." };

  const targetUser = await prisma.user.findUnique({
    where: { username: targetUsername },
  });

  if (!targetUser) return { error: "We could not find a player with that name." };
  if (targetUser.id === session.user.id) return { error: "You cannot add yourself." };

  const { userLowId, userHighId } = getLowHighIds(session.user.id, targetUser.id);

  const existing = await prisma.friendship.findUnique({
    where: { userLowId_userHighId: { userLowId, userHighId } },
  });

  if (existing) {
    return { error: "You are already friends or have a pending request." };
  }

  await prisma.friendship.create({
    data: {
      userLowId,
      userHighId,
      requestedById: session.user.id,
      status: "PENDING",
    },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function respondToRequest(friendshipId: number, accept: boolean) {
  const session = await getCurrentSession();
  if (!session) return { error: "Please sign in." };

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!friendship) return { error: "Request not found." };
  if (friendship.userLowId !== session.user.id && friendship.userHighId !== session.user.id) {
    return { error: "Unauthorized." };
  }
  if (accept) {
    if (friendship.status !== "PENDING" || friendship.requestedById === session.user.id) {
      return { error: "Invalid transition." };
    }
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        respondedAt: new Date(),
      },
    });
  } else {
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });
    await notifyFriendshipUpdate(friendship.userLowId, friendship.userHighId);
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeFriend(friendshipId: number) {
  const session = await getCurrentSession();
  if (!session) return { error: "Please sign in." };
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!friendship) return { error: "Friendship not found." };
  if (friendship.userLowId !== session.user.id && friendship.userHighId !== session.user.id) {
    return { error: "Unauthorized." };
  }
  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  await notifyFriendshipUpdate(friendship.userLowId, friendship.userHighId);

  revalidatePath("/", "layout");
  return { success: true };
}
