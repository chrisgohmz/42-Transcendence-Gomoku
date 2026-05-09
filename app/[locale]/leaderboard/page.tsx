import { BarChart3, Globe2, Medal, Trophy, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
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
    <PageShell>
      <PageHeader
        eyebrow={t("eyebrow")}
        icon={Trophy}
        title={t("title")}
        lede="Season rankings, rating movement, and self-placement for competitive Gomoku."
        actions={
          <>
            <div className="inline-flex rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1">
              {["All Players", "Friends"].map((item, index) => (
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
              Global
            </Badge>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Surface eyebrow="Ranked Table" title="Top 100">
          <LeaderboardTable entries={entries} />
          <div className="rounded-md border border-[var(--brass)]/35 bg-[linear-gradient(90deg,rgba(216,172,89,0.16),rgba(255,255,255,0.03))] p-4">
            <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_repeat(3,110px)] md:items-center">
              <div>
                <p className="m-0 text-xs font-black tracking-[0.16em] text-[var(--muted-text)] uppercase">
                  Your Rank
                </p>
                <p className="m-0 font-serif text-4xl font-black text-[var(--brass)]">3</p>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-14 place-items-center rounded-full border border-[var(--brass)]/45 bg-white/[0.08] font-black">
                  K
                </span>
                <div>
                  <p className="m-0 text-xl font-black">Kuroishi</p>
                  <p className="m-0 text-sm text-[var(--brass)]">1,842 rating</p>
                </div>
              </div>
              <MiniMetric label="Wins" value="254" />
              <MiniMetric label="Losses" value="81" />
              <MiniMetric label="Win Rate" value="75.8%" />
            </div>
          </div>
        </Surface>

        <aside className="grid content-start gap-5">
          <Surface eyebrow="Season" icon={Medal} title="Spring Ladder">
            <div className="grid gap-3">
              <MetricCard label="Days Left" tone="brass" value="18" />
              <MetricCard label="Rated Matches" tone="mint" value="12,408" />
            </div>
          </Surface>

          <Surface eyebrow="Distribution" icon={BarChart3} title="Rank Bands">
            <div className="grid gap-3">
              {[
                ["Dan", "22%", "bg-[var(--brass)]"],
                ["Kyu", "54%", "bg-[var(--mint)]"],
                ["Unranked", "24%", "bg-[var(--danger)]"],
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

          <Surface eyebrow="Top Players" icon={Users} title="This Week">
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
                    {index === 0 ? "MVP" : "+7"}
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-xl font-black tabular-nums">{value}</p>
      <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{label}</p>
    </div>
  );
}
