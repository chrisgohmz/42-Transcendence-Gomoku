import { getTranslations, setRequestLocale } from "next-intl/server";

import LeaderboardTable from "@/components/leaderboardtable";
import { getLeaderboardEntries } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type LeaderBoardProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function LeaderBoard({ params }: LeaderBoardProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, entries] = await Promise.all([
    getTranslations({ locale, namespace: "leaderboard" }),
    getLeaderboardEntries().catch(() => []),
  ]);

  return (
    <main className="app-shell app-shell-wide">
      <section className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="surface-panel content-start">
          <div className="grid place-items-center rounded-lg border border-[var(--brass)]/35 bg-[var(--brass-soft)] p-6 text-center">
            <span className="text-5xl font-black text-[var(--brass)]">桂</span>
            <p className="mt-3 text-sm font-bold tracking-[0.18em] text-[var(--muted-strong)] uppercase">
              Ranked Ladder
            </p>
          </div>

          <nav className="grid gap-2" aria-label="Leaderboard Filters">
            {["All Players", "Friends", "Global"].map((item, index) => (
              <button
                key={item}
                type="button"
                className={`rounded-md border px-3 py-2 text-left text-sm font-bold transition-[background-color,border-color] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${
                  index === 0
                    ? "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]"
                    : "border-[var(--panel-border-soft)] bg-white/[0.035] text-[var(--muted-text)] hover:border-[var(--brass)]/45"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="surface-card">
            <p className="label">Your Rank</p>
            <div className="text-4xl font-black text-[var(--brass)] tabular-nums">3</div>
            <p className="mt-2 text-sm text-[var(--muted-text)]">Ratings update in real time.</p>
          </div>
        </aside>

        <section className="surface-panel">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 className="page-title">{t("title")}</h1>
              <p className="lede">{t("lede")}</p>
            </div>
            <div className="rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-4 py-2 text-sm text-[var(--muted-text)]">
              Top 100 · Live
            </div>
          </div>

          <LeaderboardTable entries={entries} />

          <p className="mt-4 text-xs text-[var(--muted-text)]">
            Ratings update as matches complete. Top 100 refreshes every 5 minutes.
          </p>
        </section>
      </section>
    </main>
  );
}
