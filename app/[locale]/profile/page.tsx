import { Pencil, User } from "lucide-react";
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
    <main className="app-shell">
      <section className="mt-4 mb-12 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <User aria-hidden="true" className="h-12 w-12 text-[var(--brass)]" />
          <h1 className="page-title">{t("title")}</h1>
        </div>
        <p className="m-0 max-w-2xl text-center text-[var(--muted-text)]">{t("lede")}</p>
      </section>

      <section className="panel">
        <div className="grid w-full gap-5 lg:grid-cols-[minmax(280px,0.42fr)_minmax(0,1fr)]">
          <article className="surface-card flex flex-col items-center overflow-hidden text-center">
            <ProfilePicture initialImage={realUser.avatarUrl} />
            <h2 className="m-0 w-full truncate px-4 text-2xl font-bold capitalize">
              {realUser.displayName}
            </h2>
            <p className="meta m-0 mb-2 text-sm">@{realUser.username}</p>
            <div className="inline-links">
              <Link className="text-link flex items-center gap-2" href="/profile/edit">
                <Pencil aria-hidden="true" className="h-4 w-4" />
                {t("editProfile")}
              </Link>
            </div>
          </article>

          <div className="flex flex-col gap-5">
            <article className="surface-card flex flex-1 flex-col">
              <h2 className="mb-6 font-serif text-2xl font-bold">{t("statsTitle")}</h2>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-[var(--brass)] tabular-nums">0</h2>
                  <p className="meta m-0">{t("stats.rating")}</p>
                </div>
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-[var(--text)] tabular-nums">0%</h2>
                  <p className="meta m-0">{t("stats.winRate")}</p>
                </div>
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-[var(--text)] tabular-nums">0</h2>
                  <p className="meta m-0">{t("stats.wins")}</p>
                </div>
                <div className="flex flex-col justify-center rounded-lg border border-[var(--panel-border-soft)] bg-white/[0.035] p-6">
                  <h2 className="m-0 text-4xl font-black text-[var(--text)] tabular-nums">0</h2>
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
