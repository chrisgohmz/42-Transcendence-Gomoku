/* eslint-disable @next/next/no-img-element */
import {
  Activity,
  Award,
  BarChart3,
  Flag,
  Swords,
  Trophy,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge, MetricCard, PageShell, Surface } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import ProfileActions from "./profile-actions";
import ProfileBackButton from "./profile-back-button";
import ProfilePresence, { LiveAvatar } from "./profile-presence";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
    username: string;
  }>;
};

const recentMatches = [
  { key: "wonAgainstTenkei", score: "+12" },
  { key: "lostAgainstHoshi", score: "-8" },
  { key: "wonAgainstMokuren", score: "+12" },
] as const;

const achievements = ["sharpOpening", "calmEndgame", "fastRematch"] as const;

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <PublicProfilePageContent params={params} />
    </Suspense>
  );
}

async function PublicProfilePageContent({ params }: ProfilePageProps) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "profile" });

  const userProfile = await prisma.user.findUnique({
    where: { username },
    include: {
      gameStats: true,
    },
  });

  if (!userProfile) {
    notFound();
  }

  const session = await getCurrentSession();
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

  const statsList = userProfile.gameStats || [];
  const wins = statsList.reduce((total, stat) => total + stat.wins, 0);
  const losses = statsList.reduce((total, stat) => total + stat.losses, 0);
  const played = statsList.reduce((total, stat) => total + stat.matchesPlayed, 0);
  const rating = statsList.length > 0 ? Math.max(...statsList.map((s) => s.rating || 0)) : 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

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
            <MetricCard
              icon={Activity}
              label={t("stats.winRate")}
              tone="mint"
              value={`${winRate}%`}
            />
            <MetricCard icon={TrendingUp} label={t("stats.wins")} tone="mint" value={wins} />
            <MetricCard icon={TrendingDown} label={t("stats.losses")} tone="red" value={losses} />
          </div>

          <Surface
            eyebrow={t("publicPage.progress.eyebrow")}
            icon={BarChart3}
            title={t("publicPage.progress.title")}
          >
            <div className="grid h-64 items-end gap-3 rounded-md border border-[var(--panel-border-soft)] bg-black/20 p-4">
              <div className="flex h-full items-end gap-2">
                {[34, 42, 38, 56, 62, 58, 76, 72, 81, 88, 84, 92].map((height, index) => (
                  <span key={index} className="flex flex-1 items-end">
                    <span
                      className="block w-full rounded-t-sm bg-[linear-gradient(180deg,var(--mint),var(--brass))]"
                      style={{ height: `${height}%` }}
                    />
                  </span>
                ))}
              </div>
            </div>
          </Surface>

          <Surface
            eyebrow={t("publicPage.recentMatches.eyebrow")}
            title={t("publicPage.recentMatches.title")}
          >
            <div className="grid gap-2">
              {recentMatches.map((item) => (
                <article
                  key={item.key}
                  className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3"
                >
                  <span className="truncate font-black">
                    {t(`publicPage.recentMatches.items.${item.key}`)}
                  </span>
                  <Badge tone={item.key === "lostAgainstHoshi" ? "red" : "mint"}>
                    {item.score}
                  </Badge>
                </article>
              ))}
            </div>
          </Surface>
        </div>

        <aside className="grid content-start gap-5">
          <Surface
            eyebrow={t("publicPage.headToHead.eyebrow")}
            icon={Swords}
            title={t("publicPage.headToHead.title")}
          >
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label={t("publicPage.headToHead.wins")} tone="mint" value="4" />
              <MetricCard label={t("publicPage.headToHead.losses")} tone="red" value="2" />
            </div>
          </Surface>

          <Surface
            eyebrow={t("publicPage.achievements.eyebrow")}
            icon={Award}
            title={t("publicPage.achievements.title")}
          >
            <div className="grid gap-2">
              {achievements.map((item) => (
                <Badge key={item} tone="brass">
                  <Award aria-hidden="true" className="size-3.5" />
                  {t(`publicPage.achievements.items.${item}`)}
                </Badge>
              ))}
            </div>
          </Surface>

          <Surface
            eyebrow={t("publicPage.safety.eyebrow")}
            icon={Flag}
            title={t("publicPage.safety.title")}
          >
            <div className="grid gap-2">
              <button type="button" className="btn btn-subtle m-0 justify-start">
                {t("publicPage.safety.reportPlayer")}
              </button>
              <button type="button" className="btn btn-danger m-0 justify-start">
                {t("publicPage.safety.blockPlayer")}
              </button>
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}
