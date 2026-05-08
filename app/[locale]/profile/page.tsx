import { Activity, Pencil, Trophy, User } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link, redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

import ProfilePicture from "./profile-picture";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: "profile" });
  const realUser = sessionData.user;

  return (
    <main className="app-shell app-shell-wide">
      <section className="command-panel mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Player File</p>
            <h1 className="page-title">{t("title")}</h1>
            <p className="lede">{t("lede")}</p>
          </div>
          <Link className="btn m-0" href="/profile/edit">
            <Pencil aria-hidden="true" className="size-4" />
            {t("editProfile")}
          </Link>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <article className="command-panel flex flex-col items-center overflow-hidden text-center">
          <ProfilePicture initialImage={realUser.avatarUrl} />
          <h2 className="m-0 w-full truncate px-4 text-2xl font-bold capitalize">
            {realUser.displayName}
          </h2>
          <p className="meta m-0 mb-2 text-sm">@{realUser.username}</p>
          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <div className="kpi-card">
              <User aria-hidden="true" className="mb-3 size-5 text-[var(--mint)]" />
              <div className="text-xl font-black">Active</div>
              <p className="m-0 text-xs text-[var(--muted-text)]">Account</p>
            </div>
            <div className="kpi-card">
              <Trophy aria-hidden="true" className="mb-3 size-5 text-[var(--brass)]" />
              <div className="text-xl font-black">Unranked</div>
              <p className="m-0 text-xs text-[var(--muted-text)]">Tier</p>
            </div>
          </div>
        </article>

        <section className="grid gap-5">
          <article className="surface-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Performance</p>
                <h2 className="font-serif text-3xl font-bold">{t("statsTitle")}</h2>
              </div>
              <Activity aria-hidden="true" className="size-6 text-[var(--mint)]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [t("stats.rating"), "0", "text-[var(--brass)]"],
                [t("stats.winRate"), "0%", "text-[var(--mint)]"],
                [t("stats.wins"), "0", "text-[var(--text)]"],
                [t("stats.losses"), "0", "text-[var(--text)]"],
              ].map(([label, value, tone]) => (
                <div key={label} className="kpi-card">
                  <h3 className={`m-0 text-4xl font-black tabular-nums ${tone}`}>{value}</h3>
                  <p className="meta m-0 mt-2">{label}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="command-panel">
            <p className="eyebrow">Next Up</p>
            <h2 className="font-serif text-3xl font-bold">No active match yet.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-[var(--muted-text)]">
              Start an AI drill or join a human room to populate this file with live match context.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/game" className="btn m-0">
                Train vs AI
              </Link>
              <Link href="/human" className="btn btn-danger m-0">
                Find Room
              </Link>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
