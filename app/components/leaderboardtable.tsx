import { Medal } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const t = useTranslations("leaderboard.table");

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e]/80">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("rank")}</TableHead>
            <TableHead>{t("player")}</TableHead>
            <TableHead>{t("rating")}</TableHead>
            <TableHead>{t("wins")}</TableHead>
            <TableHead>{t("losses")}</TableHead>
            <TableHead>{t("winRate")}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-[var(--muted-text)]">
                <Medal aria-hidden="true" className="mx-auto mb-3 size-8 text-[var(--brass)]" />
                <span className="font-semibold">{t("empty")}</span>
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.playerId}>
                <TableCell className="font-black text-[var(--brass)] tabular-nums">
                  {entry.rank <= 3 ? (
                    <span className="inline-grid size-8 place-items-center rounded-full border border-[var(--brass)]/45 bg-[var(--brass-soft)]">
                      {entry.rank}
                    </span>
                  ) : (
                    entry.rank
                  )}
                </TableCell>
                <TableCell className="text-[var(--text)]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.06] font-bold uppercase">
                      {entry.player.charAt(0)}
                    </span>
                    <span className="truncate font-semibold">{entry.player}</span>
                    <span className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]" />
                  </div>
                </TableCell>
                <TableCell className="font-bold text-[var(--text)] tabular-nums">
                  {entry.rating}
                </TableCell>
                <TableCell className="tabular-nums">{entry.wins}</TableCell>
                <TableCell className="tabular-nums">{entry.losses}</TableCell>
                <TableCell className="font-semibold text-[var(--mint)] tabular-nums">
                  {entry.winRate}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
