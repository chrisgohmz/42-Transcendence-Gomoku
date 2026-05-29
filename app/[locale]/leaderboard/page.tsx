import { AlertTriangle, BarChart3, Globe2, Medal, Trophy, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import LeaderboardClient from "@/components/leaderboard-client";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { parseLeaderboardSearchParams } from "@/lib/advanced-search";
import { getCurrentSessionIdentity } from "@/lib/auth";
import {
  getLeaderboardSearchSnapshot,
  type LeaderboardSnapshot,
  type LeaderboardEntry,
  type LeaderboardScope,
} from "@/lib/leaderboard";
import { createPageMetadata } from "@/lib/page-metadata";
import { getSeasonSnapshot, type SeasonSnapshot } from "@/lib/stats/season-stats";

type LeaderBoardProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    band?: string | string[];
    limit?: string | string[];
    maxRating?: string | string[];
    minMatches?: string | string[];
    minRating?: string | string[];
    page?: string | string[];
    q?: string | string[];
    scope?: string | string[];
    sort?: string | string[];
  }>;
};

export const generateMetadata = createPageMetadata("leaderboard");

export default function LeaderBoard({ params, searchParams }: LeaderBoardProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <LeaderBoardContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type RankBand = "dan" | "kyu" | "unranked";

function countRankBands(entries: LeaderboardEntry[]) {
  return entries.reduce(
    (accumulator, entry) => {
      const band = getRankBand(entry.rating);
      accumulator[band] += 1;
      return accumulator;
    },
    {
      dan: 0,
      kyu: 0,
      unranked: 0,
    } as Record<RankBand, number>,
  );
}

function getRankBand(rating: number): RankBand {
  if (rating >= 1800) return "dan";
  if (rating >= 1000) return "kyu";
  return "unranked";
}

function LeaderboardEmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025] p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.03]">
          <Medal aria-hidden="true" className="size-6 text-[var(--brass)]" />
        </div>
        <h3 className="m-0 mb-2 font-serif text-xl font-black">{title}</h3>
        <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">{description}</p>
      </div>
    </div>
  );
}

async function LeaderBoardContent({ params, searchParams }: LeaderBoardProps) {
  const { locale } = await params;
  const rawSearchParams = await searchParams;
  setRequestLocale(locale);
  await connection();

  const t = await getTranslations({ locale, namespace: "leaderboard" });
  let snapshot: LeaderboardSnapshot = { entries: [], currentUser: null };
  let seasonSnapshot: SeasonSnapshot = {
    daysLeft: 0,
    ratedMatchCount: 0,
    season: {
      daysLeft: 0,
      end: new Date(0),
      season: 1,
      start: new Date(0),
      year: 1970,
    },
  };
  let leaderboardUnavailable = false;
  const queryParams = toUrlSearchParams(rawSearchParams);
  const query = parseLeaderboardSearchParams(queryParams);
  const scope = query.scope;

  try {
    const session = await getCurrentSessionIdentity();
    const [leaderboardData, seasonData] = await Promise.all([
      getLeaderboardSearchSnapshot(session?.user.id ?? null, query),
      getSeasonSnapshot(),
    ]);
    snapshot = leaderboardData;
    seasonSnapshot = seasonData;
  } catch (error) {
    leaderboardUnavailable = true;
    console.error("Failed to load leaderboard entries.", error);
  }

  const entries = snapshot.entries ?? [];
  const bandCounts = countRankBands(entries);
  const distribution =
    entries.length > 0
      ? [
          {
            key: "dan",
            label: t("page.distribution.labels.dan"),
            count: bandCounts.dan,
          },
          {
            key: "kyu",
            label: t("page.distribution.labels.kyu"),
            count: bandCounts.kyu,
          },
          {
            key: "unranked",
            label: t("page.distribution.labels.unranked"),
            count: bandCounts.unranked,
          },
        ].map((band) => ({ ...band, share: `${Math.round((band.count / entries.length) * 100)}%` }))
      : [];
  const topPlayers = entries.slice(0, 3);
  const ScopeIcon = scope === "friends" ? Users : Globe2;
  const scopeLabel = scope === "friends" ? t("page.scope.friends") : t("page.scope.global");

  const tabBaseClass =
    "inline-flex min-h-10 min-w-32 items-center justify-center rounded-sm px-4 text-sm font-black transition-colors";
  const activeTabClass = "bg-[var(--mint-soft)] text-[var(--mint)]";
  const inactiveTabClass = "text-[var(--muted-text)] hover:text-[var(--text)]";

  const buildScopeHref = (nextScope: LeaderboardScope) => {
    const params = new URLSearchParams(queryParams);
    params.set("scope", nextScope);
    params.delete("page");
    return `?${params.toString()}`;
  };

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
              <Link
                className={`${tabBaseClass} ${scope === "all" ? activeTabClass : inactiveTabClass}`}
                href={buildScopeHref("all")}
              >
                {t("page.tabs.allPlayers")}
              </Link>
              <Link
                className={`${tabBaseClass} ${scope === "friends" ? activeTabClass : inactiveTabClass}`}
                href={buildScopeHref("friends")}
              >
                {t("page.tabs.friends")}
              </Link>
            </div>
            <Badge tone="brass">
              <ScopeIcon aria-hidden="true" className="size-3.5" />
              {scopeLabel}
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
              <LeaderboardClient
                initial={snapshot}
                scope={scope}
                query={query}
                queryString={queryParams.toString()}
              />
            </>
          )}
        </Surface>

        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("page.season.eyebrow")} icon={Medal} title={t("page.season.title")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label={t("page.season.daysLeft")}
                tone="brass"
                value={seasonSnapshot.daysLeft}
              />
              <MetricCard
                label={t("page.season.ratedMatches")}
                tone="mint"
                value={seasonSnapshot.ratedMatchCount.toLocaleString()}
              />
            </div>
          </Surface>

          <Surface
            eyebrow={t("page.distribution.eyebrow")}
            icon={BarChart3}
            title={t("page.distribution.title")}
          >
            {entries.length === 0 ? (
              <LeaderboardEmptyState
                description={t("table.empty.description")}
                title={t("table.empty.title")}
              />
            ) : (
              <div className="grid gap-3">
                {distribution.map((band) => (
                  <div key={band.key}>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold">
                      <span>{band.label}</span>
                      <span className="text-[var(--muted-text)] tabular-nums">{band.share}</span>
                    </div>
                    <progress
                      aria-label={`${band.label}: ${band.share}`}
                      className={`csp-progress csp-progress-${band.key}`}
                      max={entries.length}
                      value={band.count}
                    >
                      {band.share}
                    </progress>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface
            eyebrow={t("page.topPlayers.eyebrow")}
            icon={Users}
            title={t("page.topPlayers.title")}
          >
            {topPlayers.length === 0 ? (
              <LeaderboardEmptyState
                description={t("table.empty.description")}
                title={t("table.empty.title")}
              />
            ) : (
              <div className="grid gap-2">
                {topPlayers.map((entry) => {
                  const band = getRankBand(entry.rating);
                  const bandLabel =
                    band === "dan"
                      ? t("page.distribution.labels.dan")
                      : band === "kyu"
                        ? t("page.distribution.labels.kyu")
                        : t("page.distribution.labels.unranked");

                  return (
                    <div
                      key={entry.playerId}
                      className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3"
                    >
                      <span className="font-serif text-2xl font-bold text-[var(--brass)]">
                        {entry.rank}
                      </span>
                      <span className="truncate font-black">{entry.player}</span>
                      <Badge
                        tone={entry.rank === 1 ? "brass" : entry.rank === 2 ? "mint" : "neutral"}
                      >
                        {bandLabel}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}

function toUrlSearchParams(input: Awaited<LeaderBoardProps["searchParams"]>): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue) {
      params.set(key, firstValue);
    }
  });

  return params;
}

function LeaderboardUnavailable({ description, title }: { description: string; title: string }) {
  return (
    <section
      className="grid min-h-[340px] place-items-center rounded-md border border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.14)] p-8 text-center"
      aria-live="polite"
    >
      <div className="max-w-md">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md border border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.18)]">
          <AlertTriangle aria-hidden="true" className="size-6 text-[var(--danger)]" />
        </span>
        <h2 className="m-0 font-serif text-3xl leading-none font-black">{title}</h2>
        <p className="mt-3 mb-0 text-sm leading-6 text-[var(--muted-text)]">{description}</p>
      </div>
    </section>
  );
}
