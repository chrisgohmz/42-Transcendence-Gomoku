import { Medal } from "lucide-react";
import { useTranslations } from "next-intl";

type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: string;
};

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
};

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const t = useTranslations("leaderboard.table");
  const rows = entries;
  const isEmpty = entries.length === 0;

  return (
    <div className="grid gap-3">
      {isEmpty ? (
        <div className="grid min-h-[140px] place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.02] p-6 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.03]">
              <Medal aria-hidden="true" className="size-6 text-[var(--brass)]" />
            </div>
            <h3 className="m-0 mb-2 font-serif text-xl font-black">{t("empty.title")}</h3>
            <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">
              {t("empty.description")}
            </p>
          </div>
        </div>
      ) : null}

      <div
        data-testid="leaderboard-table"
        className="overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]"
      >
        <div className="hidden grid-cols-[64px_minmax(150px,1fr)_86px_82px_64px_72px_82px] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase md:grid">
          <span>{t("rank")}</span>
          <span>{t("player")}</span>
          <span>{t("rating")}</span>
          <span>{t("matches")}</span>
          <span>{t("wins")}</span>
          <span>{t("losses")}</span>
          <span>{t("winRate")}</span>
        </div>

        {rows.map((entry) => (
          <article
            key={entry.playerId}
            className="grid gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 transition-[background-color] last:border-b-0 hover:bg-white/[0.055] md:grid-cols-[64px_minmax(150px,1fr)_86px_82px_64px_72px_82px] md:items-center"
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid size-11 place-items-center rounded-full border font-black tabular-nums ${
                  entry.rank <= 3
                    ? "border-[var(--brass)]/45 bg-[var(--brass-soft)] text-[var(--brass)]"
                    : "border-[var(--panel-border-soft)] bg-white/[0.045] text-[var(--muted-strong)]"
                }`}
              >
                {entry.rank}
              </span>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.08] font-black uppercase">
                {entry.player.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="m-0 flex min-w-0 items-center gap-2 font-black">
                  <span className="truncate">{entry.player}</span>
                </p>
              </div>
            </div>

            <Metric label={t("rating")} value={entry.rating.toLocaleString("en-US")} accent />
            <Metric label={t("matches")} value={entry.matchesPlayed} />
            <Metric label={t("wins")} value={entry.wins} />
            <Metric label={t("losses")} value={entry.losses} />
            <Metric label={t("winRate")} value={entry.winRate} accent />
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="m-0 text-xs font-bold text-[var(--muted-text)] md:hidden">{label}</p>
      <p
        className={`m-0 font-black tabular-nums ${accent ? "text-[var(--brass)]" : "text-[var(--text)]"}`}
      >
        {value}
      </p>
    </div>
  );
}
