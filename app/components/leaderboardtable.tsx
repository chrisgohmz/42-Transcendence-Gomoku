import { Medal, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: string;
};

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
};

const previewEntries: LeaderboardEntry[] = [
  {
    playerId: "preview-1",
    rank: 1,
    player: "Hoshi",
    rating: 2341,
    wins: 312,
    losses: 68,
    winRate: "82.1%",
  },
  {
    playerId: "preview-2",
    rank: 2,
    player: "RenjuMaster",
    rating: 2187,
    wins: 276,
    losses: 74,
    winRate: "78.9%",
  },
  {
    playerId: "preview-3",
    rank: 3,
    player: "Kuroishi",
    rating: 2042,
    wins: 254,
    losses: 81,
    winRate: "75.8%",
  },
  {
    playerId: "preview-4",
    rank: 4,
    player: "Shirotora",
    rating: 1898,
    wins: 233,
    losses: 91,
    winRate: "71.9%",
  },
  {
    playerId: "preview-5",
    rank: 5,
    player: "Tenkei",
    rating: 1756,
    wins: 201,
    losses: 83,
    winRate: "70.8%",
  },
  {
    playerId: "preview-6",
    rank: 6,
    player: "Mokuren",
    rating: 1643,
    wins: 189,
    losses: 96,
    winRate: "66.3%",
  },
  {
    playerId: "preview-7",
    rank: 7,
    player: "GomokuSoul",
    rating: 1532,
    wins: 174,
    losses: 104,
    winRate: "62.6%",
  },
  {
    playerId: "preview-8",
    rank: 8,
    player: "IshiNoKokoro",
    rating: 1421,
    wins: 158,
    losses: 109,
    winRate: "59.2%",
  },
];

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const t = useTranslations("leaderboard.table");
  const rows = entries.length > 0 ? entries : previewEntries;
  const isPreview = entries.length === 0;

  return (
    <div className="grid gap-3">
      {isPreview ? (
        <div className="flex items-center gap-2 rounded-md border border-[var(--brass)]/30 bg-[var(--brass-soft)] px-3 py-2 text-sm font-bold text-[var(--muted-strong)]">
          <Medal aria-hidden="true" className="size-4 text-[var(--brass)]" />
          Preview standings are shown until completed matches report results.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
        <div className="hidden grid-cols-[76px_minmax(0,1fr)_110px_90px_90px_110px_110px] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase md:grid">
          <span>{t("rank")}</span>
          <span>{t("player")}</span>
          <span>{t("rating")}</span>
          <span>{t("wins")}</span>
          <span>{t("losses")}</span>
          <span>{t("winRate")}</span>
          <span>Trend</span>
        </div>

        {rows.map((entry) => (
          <article
            key={entry.playerId}
            className="grid gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 transition-[background-color] last:border-b-0 hover:bg-white/[0.055] md:grid-cols-[76px_minmax(0,1fr)_110px_90px_90px_110px_110px] md:items-center"
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
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.08] font-black uppercase">
                {entry.player.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="m-0 flex min-w-0 items-center gap-2 truncate font-black">
                  <span className="truncate">{entry.player}</span>
                  <span className="size-2 rounded-full bg-[var(--mint)]" />
                </p>
                <p className="m-0 flex items-center gap-1 text-xs text-[var(--muted-text)]">
                  <TrendingUp aria-hidden="true" className="size-3 text-[var(--mint)]" />
                  Active this week
                </p>
              </div>
            </div>

            <Metric label={t("rating")} value={entry.rating.toLocaleString("en-US")} accent />
            <Metric label={t("wins")} value={entry.wins} />
            <Metric label={t("losses")} value={entry.losses} />
            <Metric label={t("winRate")} value={entry.winRate} accent />
            <TrendBar rank={entry.rank} />
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

function TrendBar({ rank }: { rank: number }) {
  const width = Math.max(38, 92 - rank * 5);

  return (
    <div className="hidden items-center gap-2 md:flex">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <span
          className="block h-full rounded-full bg-[linear-gradient(90deg,var(--mint),var(--brass))]"
          style={{ width: `${width}%` }}
        />
      </span>
    </div>
  );
}
