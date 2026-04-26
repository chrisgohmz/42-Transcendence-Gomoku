import LeaderboardTable from "@/components/leaderboardtable";

const entries = [
  {
    playerId: 1,
    rank: 1,
    player: "tan ah kao",
    rating: 9001,
    wins: 76,
    losses: 67,
    winRate: "53.15%",
  },
  {
    playerId: 2,
    rank: 2,
    player: "lim ah kao",
    rating: 9000,
    wins: 76,
    losses: 68,
    winRate: "52.78%",
  },
];

export default function LeaderBoard() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-sm tracking-[0.2em] text-cyan-300 uppercase">Rankings</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Leaderboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            To get the player ranking from the database later
          </p>
        </div>
        <LeaderboardTable entries={entries} />
      </section>
    </main>
  );
}
