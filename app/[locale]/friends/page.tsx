import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { PageLoadingShell } from "@/components/page-loading-shell";
import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import FriendsContent from "./friends-layout";

type FriendsPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    query?: string | string[];
  }>;
};

function getSearchQuery(query: string | string[] | undefined) {
  const rawQuery = Array.isArray(query) ? query[0] : query;
  return rawQuery?.trim() ?? "";
}

export default function FriendsPage({ params, searchParams }: FriendsPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <FriendsPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function FriendsPageContent({ params, searchParams }: FriendsPageProps) {
  const { locale } = await params;
  const { query } = await searchParams;
  setRequestLocale(locale);

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
    return null;
  }

  const currentUserId = sessionData.user.id;
  const searchQuery = getSearchQuery(query);

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userLowId: currentUserId }, { userHighId: currentUserId }],
    },
    include: {
      userLow: {
        include: { gameStats: { where: { ruleType: "GOMOKU" } } },
      },
      userHigh: {
        include: { gameStats: { where: { ruleType: "GOMOKU" } } },
      },
    },
  });

  const searchResults =
    searchQuery.length >= 3
      ? await prisma.user.findMany({
          where: {
            OR: [
              { username: { startsWith: searchQuery, mode: "insensitive" } },
              { displayName: { startsWith: searchQuery, mode: "insensitive" } },
            ],
            NOT: { id: currentUserId },
          },
          take: 5,
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        })
      : [];

  const friends = [];
  const pendingRequests = [];
  const sentRequests = [];

  for (const friendship of friendships) {
    const isUserLow = friendship.userLowId === currentUserId;
    const otherUser = isUserLow ? friendship.userHigh : friendship.userLow;

    const rawStats = otherUser.gameStats[0];

    const friendData = {
      id: friendship.id,
      userId: otherUser.id,
      username: otherUser.username,
      displayName: otherUser.displayName,
      avatarUrl: otherUser.avatarUrl,
      stats: rawStats
        ? {
            wins: rawStats.wins,
            losses: rawStats.losses,
            matchesPlayed: rawStats.matchesPlayed,
            rating: rawStats.rating,
          }
        : null,
    };

    if (friendship.status === "ACCEPTED") {
      friends.push(friendData);
    } else if (friendship.status === "PENDING") {
      if (friendship.requestedById === currentUserId) {
        sentRequests.push(friendData);
      } else {
        pendingRequests.push(friendData);
      }
    }
  }

  return (
    <FriendsContent
      friends={friends}
      pendingRequests={pendingRequests}
      sentRequests={sentRequests}
      searchQuery={searchQuery}
      searchResults={searchResults}
    />
  );
}
