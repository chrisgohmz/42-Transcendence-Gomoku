/* eslint-disable @next/next/no-img-element */
import { Activity, Trophy } from "lucide-react";
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
    <main className="app-shell app-shell-wide">
      <section className="command-panel mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Public Player File</p>
            <h1 className="page-title">{userProfile.displayName}</h1>
            <p className="lede">@{userProfile.username}</p>
          </div>
          {(relationshipState === "FRIENDS" || relationshipState === "SELF") && (
            <ProfilePresence username={userProfile.username} />
          )}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <article className="command-panel flex flex-col items-center overflow-hidden py-8 text-center">
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
          <h2 className="m-0 mb-1 px-4 text-2xl font-bold capitalize">{userProfile.displayName}</h2>
          <div className="flex items-center justify-center gap-4">
            <p className="meta m-0 text-sm">@{userProfile.username}</p>
          </div>
          <ProfileActions
            targetUserId={userProfile.id}
            targetUsername={userProfile.username}
            initialState={relationshipState}
          />
        </article>

        <section className="grid gap-5">
          <article className="surface-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Performance</p>
                <h2 className="font-serif text-3xl font-bold">{t("friendStatsTitle")}</h2>
              </div>
              <Activity aria-hidden="true" className="size-6 text-[var(--mint)]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [t("stats.rating"), rating, "text-[var(--brass)]"],
                [t("stats.winRate"), `${winRate}%`, "text-[var(--mint)]"],
                [t("stats.wins"), wins, "text-[var(--text)]"],
                [t("stats.losses"), losses, "text-[var(--text)]"],
              ].map(([label, value, tone]) => (
                <div key={label} className="kpi-card">
                  <h3 className={`m-0 text-4xl font-black tabular-nums ${tone}`}>{value}</h3>
                  <p className="meta m-0 mt-2">{label}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="command-panel">
            <Trophy aria-hidden="true" className="mb-4 size-7 text-[var(--brass)]" />
            <p className="eyebrow">Scouting Notes</p>
            <h2 className="font-serif text-3xl font-bold">Watch their opening shape.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-[var(--muted-text)]">
              Public profiles are ready for richer match history once completed games start flowing
              into the ladder.
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}
