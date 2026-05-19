"use client";

import { Activity, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { MetricCard } from "@/components/gomoku-ui";
import MatchHistoryList from "@/components/match-history-list";
import ProgressionSummary from "@/components/progression-summary";
import { useProfileStats } from "@/hooks/useProfileStats";

function formatValue(
  value: number | string | null | undefined,
  fallback: string,
  isLoading: boolean,
) {
  if (isLoading) {
    return "...";
  }

  return value ?? fallback;
}

export default function ProfileStatsPanel() {
  const t = useTranslations("profile");
  const { data, error, isLoading, refresh } = useProfileStats();

  const stats = data?.stats ?? null;
  const ratingValue = formatValue(stats?.rating, t("page.stats.unrated"), isLoading);
  const winRateValue = formatValue(stats?.winRate, t("page.stats.unavailable"), isLoading);
  const winsValue = formatValue(stats?.wins, t("page.stats.unavailable"), isLoading);
  const lossesValue = formatValue(stats?.losses, t("page.stats.unavailable"), isLoading);

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-5">
        {error ? (
          <div className="rounded-md border border-[var(--danger)]/40 bg-[rgb(216_60_52_/_0.12)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[var(--danger)]">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-subtle m-0"
                onClick={() => {
                  void refresh();
                }}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {t("page.actions.retry")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Trophy} label={t("stats.rating")} tone="brass" value={ratingValue} />
          <MetricCard icon={Activity} label={t("stats.winRate")} tone="mint" value={winRateValue} />
          <MetricCard icon={TrendingUp} label={t("stats.wins")} tone="mint" value={winsValue} />
          <MetricCard
            icon={TrendingDown}
            label={t("stats.losses")}
            tone="red"
            value={lossesValue}
          />
        </div>

        <MatchHistoryList matches={data?.recentMatches ?? []} isLoading={isLoading} error={error} />
      </div>

      <ProgressionSummary
        achievements={data?.achievements ?? []}
        progression={data?.progression ?? null}
        rank={data?.rank ?? null}
        stats={stats}
        isLoading={isLoading}
      />
    </section>
  );
}
