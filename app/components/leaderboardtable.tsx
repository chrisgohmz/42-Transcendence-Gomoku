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
  playerId: number;
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
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold text-slate-200">{t("rank")}</TableHead>
            <TableHead className="font-semibold text-slate-200">{t("player")}</TableHead>
            <TableHead className="font-semibold text-slate-200">{t("rating")}</TableHead>
            <TableHead className="font-semibold text-slate-200">{t("wins")}</TableHead>
            <TableHead className="font-semibold text-slate-200">{t("losses")}</TableHead>
            <TableHead className="font-semibold text-slate-200">{t("winRate")}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-300">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.playerId}>
                <TableCell>{entry.rank}</TableCell>
                <TableCell>{entry.player}</TableCell>
                <TableCell>{entry.rating}</TableCell>
                <TableCell>{entry.wins}</TableCell>
                <TableCell>{entry.losses}</TableCell>
                <TableCell>{entry.winRate}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
