/* eslint-disable @next/next/no-img-element */
import { User } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import ProfileActions from "./profile-actions";
import ProfilePresence from "./profile-presence";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
    username: string;
  }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
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
            userLowId,
            userHighId,
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

  return (
    <main className="app-shell">
      <section className="mt-4 mb-2 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <User aria-hidden="true" className="h-12 w-12 text-[var(--brass)]" />
          <h1 className="page-title">{t("title")}</h1>
        </div>
      </section>

      <section className="panel">
        <div className="grid w-full gap-5 lg:grid-cols-[minmax(280px,0.42fr)_minmax(0,1fr)]">
          <article className="surface-card flex flex-col items-center overflow-hidden py-8 text-center">
            {userProfile.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.displayName}
                width={300}
                height={300}
                loading="lazy"
                className="mb-6 h-[240px] w-[240px] rounded-full border border-[var(--brass)]/35 bg-transparent object-cover shadow-lg shadow-[#000000]/50 sm:h-[300px] sm:w-[300px]"
              />
            ) : (
              <div className="mb-6 flex h-[240px] w-[240px] items-center justify-center rounded-full border border-[var(--brass)]/35 bg-white/[0.08] text-8xl font-bold text-white uppercase shadow-lg shadow-[#000000]/50 sm:h-[300px] sm:w-[300px]">
                {userProfile.displayName.charAt(0)}
              </div>
            )}
            <h2 className="m-0 mb-1 px-4 text-2xl font-bold capitalize">
              {userProfile.displayName}
            </h2>
            <div className="flex items-center justify-center gap-4">
              <p className="meta m-0 text-sm">@{userProfile.username}</p>
              {(relationshipState === "FRIENDS" || relationshipState === "SELF") && (
                <ProfilePresence username={userProfile.username} />
              )}
            </div>
            <ProfileActions
              targetUserId={userProfile.id}
              targetUsername={userProfile.username}
              initialState={relationshipState}
            />
          </article>

          <div className="flex flex-col gap-5">
            <article className="surface-card flex flex-1 flex-col">
              <h2 className="mb-6 font-serif text-2xl font-bold">{t("friendStatsTitle")}</h2>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-[var(--brass)] tabular-nums">
                    {rating}
                  </h2>
                  <p className="meta m-0">{t("stats.rating")}</p>
                </div>
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-white tabular-nums">{winRate}%</h2>
                  <p className="meta m-0">{t("stats.winRate")}</p>
                </div>
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-white tabular-nums">{wins}</h2>
                  <p className="meta m-0">{t("stats.wins")}</p>
                </div>
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-white tabular-nums">{losses}</h2>
                  <p className="meta m-0">{t("stats.losses")}</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
