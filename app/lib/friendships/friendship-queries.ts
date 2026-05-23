import type { Prisma } from "../../../generated/prisma/client";
import { FriendshipStatus } from "../../../generated/prisma/enums";
import type { prisma } from "../prisma";

type FriendshipClient = Pick<typeof prisma, "friendship">;

type FriendshipSideIds = {
  userHighId: string;
  userLowId: string;
};

const friendshipSideSelect = {
  userHighId: true,
  userLowId: true,
} satisfies Prisma.FriendshipSelect;

export function friendshipForUserWhere(userId: string): Prisma.FriendshipWhereInput {
  return {
    OR: [{ userLowId: userId }, { userHighId: userId }],
  };
}

export function acceptedFriendshipWhere(userId: string): Prisma.FriendshipWhereInput {
  return {
    ...friendshipForUserWhere(userId),
    status: FriendshipStatus.ACCEPTED,
  };
}

export function getOtherFriendshipUserId(friendship: FriendshipSideIds, userId: string): string {
  return friendship.userLowId === userId ? friendship.userHighId : friendship.userLowId;
}

export function getOtherFriendshipUser<TLow, THigh>(
  friendship: FriendshipSideIds & { userHigh: THigh; userLow: TLow },
  userId: string,
): TLow | THigh {
  return friendship.userLowId === userId ? friendship.userHigh : friendship.userLow;
}

export async function getAcceptedFriendIdsForUser(
  userId: string,
  client: FriendshipClient,
): Promise<string[]> {
  const friendships = (await client.friendship.findMany({
    where: acceptedFriendshipWhere(userId),
    select: friendshipSideSelect,
  })) as FriendshipSideIds[];

  return friendships.map((friendship) => getOtherFriendshipUserId(friendship, userId));
}
