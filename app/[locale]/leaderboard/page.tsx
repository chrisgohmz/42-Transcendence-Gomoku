import { AlertTriangle, BarChart3, Globe2, Medal, Trophy, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import LeaderboardClient from "@/components/leaderboard-client";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { getCurrentSession } from "@/lib/auth";
import { getLeaderboardSnapshot, type LeaderboardSnapshot } from "@/lib/leaderboard";

type LeaderBoardProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function LeaderBoard({ params }: LeaderBoardProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <LeaderBoardContent params={params} />
    </Suspense>
  );
}

async function LeaderBoardContent({ params }: LeaderBoardProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connection();

  const t = await getTranslations({ locale, namespace: "leaderboard" });
  let snapshot: LeaderboardSnapshot = { entries: [], currentUser: null };
  let leaderboardUnavailable = false;

  try {
    const session = await getCurrentSession();
    snapshot = await getLeaderboardSnapshot(session?.user.id ?? null);
  } catch (error) {
    leaderboardUnavailable = true;
    console.error("Failed to load leaderboard entries.", error);
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={t("eyebrow")}
        icon={Trophy}
        title={t("title")}
        lede={t("lede")}
        actions={
          <>
            <div className="inline-flex rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1">
              {[t("page.tabs.allPlayers"), t("page.tabs.friends")].map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={`min-h-10 min-w-32 rounded-sm px-4 text-sm font-black ${
                    index === 0
                      ? "bg-[var(--mint-soft)] text-[var(--mint)]"
                      : "text-[var(--muted-text)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <Badge tone="brass">
              <Globe2 aria-hidden="true" className="size-3.5" />
              {t("page.scope.global")}
            </Badge>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Surface eyebrow={t("page.overview.eyebrow")} title={t("page.overview.title")}>
          {leaderboardUnavailable ? (
            <LeaderboardUnavailable
              description={t("page.unavailable.description")}
              title={t("page.unavailable.title")}
            />
          ) : (
            <>
              <LeaderboardClient initial={snapshot} />
            </>
          )}
        </Surface>

        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("page.season.eyebrow")} icon={Medal} title={t("page.season.title")}>
            <div className="grid gap-3">
              <MetricCard label={t("page.season.daysLeft")} tone="brass" value="18" />
              <MetricCard label={t("page.season.ratedMatches")} tone="mint" value="12,408" />
            </div>
          </Surface>

          <Surface
            eyebrow={t("page.distribution.eyebrow")}
            icon={BarChart3}
            title={t("page.distribution.title")}
          >
            <div className="grid gap-3">
              {[
                [t("page.distribution.labels.dan"), "22%", "bg-[var(--brass)]"],
                [t("page.distribution.labels.kyu"), "54%", "bg-[var(--mint)]"],
                [t("page.distribution.labels.unranked"), "24%", "bg-[var(--danger)]"],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between text-sm font-bold">
                    <span>{label}</span>
                    <span className="text-[var(--muted-text)] tabular-nums">{value}</span>
                  </div>
                  <span className="block h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <span
                      className={`block h-full rounded-full ${color}`}
                      style={{ width: value }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface
            eyebrow={t("page.topPlayers.eyebrow")}
            icon={Users}
            title={t("page.topPlayers.title")}
          >
            <div className="grid gap-2">
              {["Hoshi", "RenjuMaster", "Kuroishi"].map((name, index) => (
                <div
                  key={name}
                  className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3"
                >
                  <span className="font-serif text-2xl font-bold text-[var(--brass)]">
                    {index + 1}
                  </span>
                  <span className="truncate font-black">{name}</span>
                  <Badge tone={index === 0 ? "brass" : "neutral"}>
                    {index === 0
                      ? t("page.topPlayers.badges.mvp")
                      : t("page.topPlayers.badges.boost")}
                  </Badge>
                </div>
              ))}
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}

function LeaderboardUnavailable({ description, title }: { description: string; title: string }) {
  return (
    <div
      className="grid min-h-[340px] place-items-center rounded-md border border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.14)] p-8 text-center"
      role="status"
    >
      <div className="max-w-md">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md border border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.18)]">
          <AlertTriangle aria-hidden="true" className="size-6 text-[var(--danger)]" />
        </span>
        <h2 className="m-0 font-serif text-3xl leading-none font-black">{title}</h2>
        <p className="mt-3 mb-0 text-sm leading-6 text-[var(--muted-text)]">{description}</p>
      </div>
    </div>
  );
}
