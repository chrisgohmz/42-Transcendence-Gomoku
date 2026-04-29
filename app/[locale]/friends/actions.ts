"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getLowHighIds(id1: string, id2: string) {
  return id1 < id2
    ? { userLowId: id1, userHighId: id2 }
    : { userLowId: id2, userHighId: id1 };
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

  revalidatePath("/");
  return { success: true };
}

export async function respondToRequest(friendshipId: number, accept: boolean) {
  const session = await getCurrentSession();
  if (!session) return { error: "Please sign in." };

  if (accept) {
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
  }

  revalidatePath("/");
  return { success: true };
}

export async function removeFriend(friendshipId: number) {
  const session = await getCurrentSession();
  if (!session) return { error: "Please sign in." };

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath("/");
  return { success: true };
}

export async function searchUsers(query: string) {
  const session = await getCurrentSession();
  if (!session) return { error: "Please sign in." };

  if (!query || query.trim().length === 0) return { users: [] };

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
      NOT: { id: session.user.id },
    },
    take: 5,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    }
  });

  return { users };
}
