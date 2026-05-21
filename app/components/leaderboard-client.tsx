"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import LeaderboardTable from "@/components/leaderboardtable";
import { useLeaderboard } from "@/hooks/useLeaderboard";

type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: string;
};

type LeaderboardSnapshot = {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
};

export default function LeaderboardClient({ initial }: { initial?: LeaderboardSnapshot | null }) {
  const t = useTranslations("leaderboard");
  const { entries, currentUser, loading, error, refresh } = useLeaderboard(initial ?? null);

  return (
    <>
      <LeaderboardTable entries={entries} />

      <div className="rounded-md border border-[var(--brass)]/35 bg-[linear-gradient(90deg,rgba(216,172,89,0.16),rgba(255,255,255,0.03))] p-4">
        <div className="flex items-start justify-between">
          <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)_repeat(3,110px)] md:items-center">
            <div>
              <p className="m-0 text-xs font-black tracking-[0.16em] text-[var(--muted-text)] uppercase">
                {t("page.spotlight.rankLabel")}
              </p>
              <p className="m-0 font-serif text-4xl font-black text-[var(--brass)]">
                {currentUser?.rank ?? "—"}
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full border border-[var(--brass)]/45 bg-white/[0.08] font-black">
                {currentUser ? currentUser.player.charAt(0) : "?"}
              </span>
              <div>
                <p className="m-0 text-xl font-black">
                  {currentUser?.player ?? t("page.spotlight.noPlayer")}
                </p>
                <p className="m-0 text-sm text-[var(--brass)]">
                  {t("page.spotlight.rating", {
                    rating: currentUser ? currentUser.rating.toLocaleString() : "—",
                  })}
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{t("table.wins")}</p>
              <p className="m-0 font-black tabular-nums">{currentUser?.wins ?? "—"}</p>
            </div>
            <div className="hidden md:block">
              <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{t("table.losses")}</p>
              <p className="m-0 font-black tabular-nums">{currentUser?.losses ?? "—"}</p>
            </div>
            <div className="hidden md:block">
              <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{t("table.winRate")}</p>
              <p className="m-0 font-black tabular-nums">{currentUser?.winRate ?? "—"}</p>
            </div>
          </div>

          <div className="ml-4 flex items-start gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold"
              onClick={() => refresh()}
              disabled={loading}
            >
              <RefreshCw className="size-4" />
              {loading ? t("page.refreshing") : t("page.refresh")}
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </div>
    </>
  );
}
