type UserLookupResult = {
  id: string;
  username: string;
};

type FriendshipNotificationStore = {
  user: {
    findUnique(args: {
      select: {
        id: true;
        username: true;
      };
      where: {
        username: string;
      };
    }): Promise<UserLookupResult | null>;
  };
  friendship: {
    findUnique(args: {
      select: {
        id: true;
      };
      where: {
        userLowId_userHighId: {
          userHighId: string;
          userLowId: string;
        };
      };
    }): Promise<{ id: number } | null>;
  };
};

function getLowHighIds(leftUserId: string, rightUserId: string) {
  return leftUserId < rightUserId
    ? { userLowId: leftUserId, userHighId: rightUserId }
    : { userLowId: rightUserId, userHighId: leftUserId };
}

export async function resolveFriendshipNotificationTarget(
  store: FriendshipNotificationStore,
  senderId: string,
  targetUsername: string,
) {
  const target = await store.user.findUnique({
    where: { username: targetUsername },
    select: {
      id: true,
      username: true,
    },
  });

  if (!target) return null;

  const friendship = await store.friendship.findUnique({
    where: {
      userLowId_userHighId: getLowHighIds(senderId, target.id),
    },
    select: {
      id: true,
    },
  });

  return friendship ? target.username : null;
}
