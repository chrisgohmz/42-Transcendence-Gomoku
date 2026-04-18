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
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Rankings</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Leaderboard</h2>
        <p className="mt-2 text-sm text-slate-300">
          To get the player ranking from the database later
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="text-slate-200">Rank</TableHead>
                    <TableHead className="text-slate-200">Player</TableHead>
                    <TableHead className="text-slate-200">Rating</TableHead>
                    <TableHead className="text-slate-200">Wins</TableHead>
                    <TableHead className="text-slate-200">Losses</TableHead>
                    <TableHead className="text-slate-200">Win Rate</TableHead>
                </TableRow>
            </TableHeader>
            
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-300">
                    No leaderboard data yet.
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
    </section>
  );
}
