import {
  Activity,
  Award,
  Pencil,
  ShieldCheck,
  Trophy,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AvatarToken, Badge, MetricCard, PageShell, Surface } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const recentMatches = [
  {
    match: "Kuroaki vs Shiroyasha",
    result: "won",
    delta: "+14",
    note: { kind: "timeLeft", time: "01:32" },
  },
  {
    match: "Kuroaki vs Tenkei",
    result: "lost",
    delta: "-8",
    note: { kind: "resigned" },
  },
  {
    match: "Kuroaki vs Mokuren",
    result: "won",
    delta: "+11",
    note: { kind: "fiveInARow" },
  },
] as const;

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <ProfilePageContent params={params} />
    </Suspense>
  );
}

async function ProfilePageContent({ params }: ProfilePageProps) {
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
    <PageShell>
      <section className="command-panel mb-5">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-5">
            <AvatarToken image={realUser.avatarUrl} name={realUser.displayName} online size="lg" />
            <div className="min-w-0">
              <Badge tone="mint">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {t("page.hero.badge")}
              </Badge>
              <h1 className="mt-2 font-serif text-6xl leading-none font-bold max-sm:text-4xl">
                {realUser.displayName}
              </h1>
              <p className="text-lg text-[var(--muted-text)]">@{realUser.username}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/profile/edit" className="btn m-0">
              <Pencil aria-hidden="true" className="size-4" />
              {t("editProfile")}
            </Link>
            {/* <Link href="/account" className="btn btn-subtle m-0">
              Account Settings
            </Link> */}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Trophy} label={t("stats.rating")} tone="brass" value="0" />
            <MetricCard icon={Activity} label={t("stats.winRate")} tone="mint" value="0%" />
            <MetricCard icon={TrendingUp} label={t("stats.wins")} tone="mint" value="0" />
            <MetricCard icon={TrendingDown} label={t("stats.losses")} tone="red" value="0" />
          </div>

          <Surface eyebrow={t("page.recentMatches.eyebrow")} title={t("page.recentMatches.title")}>
            <div className="overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
              {recentMatches.map((item) => (
                <article
                  key={item.match}
                  className="grid min-h-16 grid-cols-[minmax(0,1fr)_80px_70px_minmax(120px,0.5fr)] items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 last:border-b-0"
                >
                  <span className="truncate font-black">{item.match}</span>
                  <Badge tone={item.result === "won" ? "mint" : "red"}>
                    {item.result === "won"
                      ? t("page.recentMatches.results.won")
                      : t("page.recentMatches.results.lost")}
                  </Badge>
                  <span
                    className={`font-black tabular-nums ${
                      item.delta.startsWith("+") ? "text-[var(--mint)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {item.delta}
                  </span>
                  <span className="truncate text-sm text-[var(--muted-text)]">
                    {item.note.kind === "timeLeft"
                      ? t("page.recentMatches.notes.timeLeft", { time: item.note.time })
                      : item.note.kind === "resigned"
                        ? t("page.recentMatches.notes.resigned")
                        : t("page.recentMatches.notes.fiveInARow")}
                  </span>
                </article>
              ))}
            </div>
          </Surface>
        </div>

        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("page.about.eyebrow")} icon={UserRound} title={t("page.about.title")}>
            <p className="m-0 leading-7 text-[var(--muted-text)]">{t("page.about.body")}</p>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label={t("page.about.rankLabel")} tone="brass" value="5-dan" />
              <MetricCard label={t("page.about.seasonLabel")} tone="mint" value="#3" />
            </div>
          </Surface>

          <Surface
            eyebrow={t("page.achievements.eyebrow")}
            icon={Award}
            title={t("page.achievements.title")}
          >
            <div className="grid gap-2">
              {["openFourSpecialist", "hundredRankedWins", "studyRoomHost"].map((item) => (
                <Badge key={item} tone="brass">
                  <Award aria-hidden="true" className="size-3.5" />
                  {item === "openFourSpecialist"
                    ? t("page.achievements.items.openFourSpecialist")
                    : item === "hundredRankedWins"
                      ? t("page.achievements.items.hundredRankedWins")
                      : t("page.achievements.items.studyRoomHost")}
                </Badge>
              ))}
            </div>
          </Surface>

          <Surface eyebrow={t("page.progress.eyebrow")} title={t("page.progress.title")}>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                <span>{t("page.progress.range", { from: "5-dan", to: "6-dan" })}</span>
                <span className="text-[var(--mint)]">68%</span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <span className="block h-full w-[68%] rounded-full bg-[linear-gradient(90deg,var(--mint),var(--brass))]" />
              </span>
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}
