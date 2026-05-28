import { Activity, Award, Swords, Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MatchResult, MatchStatus, Role } from "@/../generated/prisma/enums";
import { Badge, MetricCard, PageShell, Surface } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { getCurrentSessionIdentity } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/page-metadata";
import { prisma } from "@/lib/prisma";
import { getProfileStatsForUser } from "@/lib/stats/profile-stats";

import ProfileActions from "./profile-actions";
import ProfileBackButton from "./profile-back-button";
import ProfilePresence, { LiveAvatar } from "./profile-presence";
import PublicMatchHistory from "./public-match-history";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
    username: string;
  }>;
  searchParams?: Promise<{
    historyPage?: string | string[];
  }>;
};

type Translate = (key: string) => string;

export async function generateMetadata({ params }: ProfilePageProps) {
  const { locale, username } = await params;

  return buildPageMetadata({
    locale,
    page: "publicProfile",
    path: `/profile/${encodeURIComponent(username)}`,
    values: {
      username,
    },
  });
}

function getSearchParamNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function humanizeAchievementCode(code: string) {
  return code
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();
}

function formatAchievementLabel(code: string, t: Translate) {
  const map: Record<string, string> = {
    ai_win: t("page.achievements.items.ai_win"),
    first_friend: t("page.achievements.items.first_friend"),
    first_win: t("page.achievements.items.first_win"),
    ten_moves: t("page.achievements.items.ten_moves"),
    win_streak_3: t("page.achievements.items.win_streak_3"),
  };

  return map[code] ?? humanizeAchievementCode(code);
}

async function getHeadToHeadStats(currentUserId: string, targetUserId: string) {
  if (currentUserId === targetUserId) {
    return { wins: 0, losses: 0 };
  }

  const matches = await prisma.match.findMany({
    where: {
      status: {
        in: [MatchStatus.FINISHED, MatchStatus.CANCELLED],
      },
      AND: [
        {
          participants: {
            some: {
              role: Role.PLAYER,
              userId: currentUserId,
            },
          },
        },
        {
          participants: {
            some: {
              role: Role.PLAYER,
              userId: targetUserId,
            },
          },
        },
      ],
    },
    select: {
      participants: {
        select: {
          result: true,
          role: true,
          userId: true,
        },
      },
    },
  });

  return matches.reduce(
    (totals, match) => {
      const currentUserParticipant = match.participants.find(
        (participant) => participant.role === Role.PLAYER && participant.userId === currentUserId,
      );

      if (currentUserParticipant?.result === MatchResult.WIN) {
        totals.wins += 1;
      } else if (currentUserParticipant?.result === MatchResult.LOSS) {
        totals.losses += 1;
      }

      return totals;
    },
    { wins: 0, losses: 0 },
  );
}

export default function ProfilePage({ params, searchParams }: ProfilePageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <PublicProfilePageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PublicProfilePageContent({ params, searchParams }: ProfilePageProps) {
  const { locale, username } = await params;
  const { historyPage } = (await searchParams) ?? {};
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "profile" });
  const recentMatchesPage = getSearchParamNumber(historyPage);

  const userProfile = await prisma.user.findUnique({
    where: { username },
  });

  if (!userProfile) {
    notFound();
  }

  const session = await getCurrentSessionIdentity();
  const loggedInUserId = session?.user?.id;

  let relationshipState: "NOT_FRIENDS" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "SELF" =
    "NOT_FRIENDS";

  if (loggedInUserId) {
    if (loggedInUserId === userProfile.id) {
      relationshipState = "SELF";
    } else {
      const userLowId = loggedInUserId < userProfile.id ? loggedInUserId : userProfile.id;
      const userHighId = loggedInUserId < userProfile.id ? userProfile.id : loggedInUserId;

      const friendship = await prisma.friendship.findUnique({
        where: {
          userLowId_userHighId: {
            userHighId,
            userLowId,
          },
        },
      });

      if (friendship) {
        if (friendship.status === "ACCEPTED") {
          relationshipState = "FRIENDS";
        } else if (friendship.status === "PENDING") {
          relationshipState =
            friendship.requestedById === loggedInUserId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
        }
      }
    }
  }

  const headToHeadStatsPromise =
    loggedInUserId && loggedInUserId !== userProfile.id
      ? getHeadToHeadStats(loggedInUserId, userProfile.id)
      : Promise.resolve(null);
  const [profileStats, headToHead] = await Promise.all([
    getProfileStatsForUser(userProfile.id, {
      recentMatchesLimit: 10,
      recentMatchesPage,
    }),
    headToHeadStatsPromise,
  ]);

  const rating = profileStats.stats.rating ?? t("page.stats.unrated");
  const winRate = profileStats.stats.winRate;
  const wins = profileStats.stats.wins;
  const losses = profileStats.stats.losses;
  const unlockedAchievements = profileStats.achievements.filter((achievement) =>
    Boolean(achievement.completedAt),
  );

  const isRevealed = relationshipState === "FRIENDS" || relationshipState === "SELF";

  return (
    <PageShell>
      <ProfileBackButton />

      <section className="command-panel mb-5">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-5">
            <LiveAvatar
              image={userProfile.avatarUrl}
              name={userProfile.displayName}
              size="lg"
              username={userProfile.username}
              isRevealed={isRevealed}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="brass">
                  <Trophy aria-hidden="true" className="size-3.5" />
                  {t("publicPage.badge")}
                </Badge>
                <ProfilePresence username={userProfile.username} isRevealed={isRevealed} />
              </div>
              <h1 className="mt-4 font-serif text-6xl leading-none font-bold max-sm:text-4xl">
                {userProfile.displayName}
              </h1>
              <p className="text-lg text-[var(--muted-text)]">@{userProfile.username}</p>
            </div>
          </div>
          <div className="grid justify-items-start gap-3 xl:justify-items-end">
            <ProfileActions
              targetUserId={userProfile.id}
              targetUsername={userProfile.username}
              initialState={relationshipState}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Trophy} label={t("stats.rating")} tone="brass" value={rating} />
            <MetricCard icon={Activity} label={t("stats.winRate")} tone="mint" value={winRate} />
            <MetricCard icon={TrendingUp} label={t("stats.wins")} tone="mint" value={wins} />
            <MetricCard icon={TrendingDown} label={t("stats.losses")} tone="red" value={losses} />
          </div>

          <PublicMatchHistory
            matches={profileStats.recentMatches}
            page={profileStats.recentMatchesPagination.page}
            totalPages={profileStats.recentMatchesPagination.totalPages}
          />
        </div>

        <aside className="grid content-start gap-5">
          <Surface
            eyebrow={t("publicPage.headToHead.eyebrow")}
            icon={Swords}
            title={t("publicPage.headToHead.title")}
          >
            {headToHead ? (
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label={t("publicPage.headToHead.wins")}
                  tone="mint"
                  value={headToHead.wins}
                />
                <MetricCard
                  label={t("publicPage.headToHead.losses")}
                  tone="red"
                  value={headToHead.losses}
                />
              </div>
            ) : (
              <p className="m-0 text-sm text-[var(--muted-text)]">
                {t("publicPage.headToHead.unavailable")}
              </p>
            )}
          </Surface>

          <Surface
            eyebrow={t("publicPage.achievements.eyebrow")}
            icon={Award}
            title={t("publicPage.achievements.title")}
          >
            {unlockedAchievements.length > 0 ? (
              <div className="grid gap-2">
                {unlockedAchievements.map((achievement) => (
                  <Badge key={achievement.code} tone="brass">
                    <Award aria-hidden="true" className="size-3.5" />
                    {formatAchievementLabel(achievement.code, t)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="m-0 text-sm text-[var(--muted-text)]">{t("page.achievements.empty")}</p>
            )}
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}
