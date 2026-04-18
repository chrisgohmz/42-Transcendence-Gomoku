
import LeaderboardTable from "@/components/leaderboardtable";

const entries = [
    {
        playerId: 1,
        rank: 1,
        player: "tan ah kao",
        rating: 9001,
        wins: 76,
        losses: 67,
        winRate: "53.15%"
    },
    {
        playerId: 2,
        rank: 2,
        player: "lim ah kao",
        rating: 9000,
        wins: 76,
        losses: 68,
        winRate: "52.78%"
    }
]

/* Use for testing the table with no entries*/
const emptyEntries: {
  playerId: number;
  rank: number;
  player: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: string;
}[] = [];


export default function LeaderBoard() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-4xl">
        <LeaderboardTable entries={entries} />
      </section>
    </main>
  );
}
