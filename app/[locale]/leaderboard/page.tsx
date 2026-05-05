import { getTranslations, setRequestLocale } from "next-intl/server";

import LeaderboardTable from "@/components/leaderboardtable";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LeaderboardStat = {
  matchesPlayed: number;
  rating: number | null;
  wins: number;
  losses: number;
  user: {
    displayName: string;
  };
};

function formatWinRate(wins: number, matchesPlayed: number): string {
  if (matchesPlayed === 0) {
    return "0.00%";
  }

  return `${((wins / matchesPlayed) * 100).toFixed(2)}%`;
}

export default async function LeaderBoard() {
  const stats: LeaderboardStat[] = await prisma.userGameStats.findMany({
    where: {
      ruleType: "GOMOKU",
      boardSize: 15,
    },
    include: {
      user: true,
    },
    orderBy: [
      {
        rating: "desc",
      },
      {
        wins: "desc",
      },
      {
        losses: "asc",
      },
    ],
  });

  const entries = stats.map((stat, index) => ({
    playerId: index + 1,
    rank: index + 1,
    player: stat.user.displayName,
    rating: stat.rating ?? 0,
    wins: stat.wins,
    losses: stat.losses,
    winRate: formatWinRate(stat.wins, stat.matchesPlayed),
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-sm tracking-[0.2em] text-cyan-300 uppercase">Rankings</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Leaderboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Rankings are loaded from Gomoku player stats in the database.
          </p>
        </div>
        <LeaderboardTable entries={entries} />
      </section>
    </main>
  );
}
