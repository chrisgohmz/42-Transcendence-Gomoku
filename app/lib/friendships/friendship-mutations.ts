import { prisma } from "@/lib/prisma";

import { publishFriendshipUpdate } from "./realtime-publisher";

type FriendshipSnapshot = {
  id: number;
  userHighId: string;
  userLowId: string;
};

export function getLowHighIds(id1: string, id2: string) {
  return id1 < id2 ? { userLowId: id1, userHighId: id2 } : { userLowId: id2, userHighId: id1 };
}

export async function notifyFriendshipUpdateForUserIds(userLowId: string, userHighId: string) {
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [userLowId, userHighId],
      },
    },
    select: {
      id: true,
      username: true,
    },
  });

  const usernameById = new Map(users.map((user) => [user.id, user.username]));
  const userLowUsername = usernameById.get(userLowId);
  const userHighUsername = usernameById.get(userHighId);

  if (!userLowUsername || !userHighUsername) {
    return;
  }

  await publishFriendshipUpdate([userLowUsername, userHighUsername]);
}

export async function notifyFriendshipUpdateForUserIdsSafely(
  userLowId: string,
  userHighId: string,
) {
  try {
    await notifyFriendshipUpdateForUserIds(userLowId, userHighId);
  } catch (error) {
    console.error("Failed to notify realtime server", error);
  }
}

export async function deleteFriendshipAndNotify(friendship: FriendshipSnapshot) {
  await prisma.friendship.delete({
    where: { id: friendship.id },
  });

  await notifyFriendshipUpdateForUserIdsSafely(friendship.userLowId, friendship.userHighId);
}
