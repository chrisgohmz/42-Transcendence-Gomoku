import CreateRoomCard from "@/components/create-room-card"
import GameLobbyTable from "@/components/game-lobby-table";

/* Use for testing the table with no entries*/
const emptyEntries: {
  roomId: number;
  player: string;
  requiresPassword: boolean;
}[] = [];

const entries = [
  {
    roomId: 1,
    player: "Mintan",
    requiresPassword: true,
  },
  {
    roomId: 2,
    player: "Aiko",
    requiresPassword: false,
  },
];


export default function vsHuman() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
    <section className="mx-auto max-w-4xl space-y-8">
        <div className="mx-auto max-w-xl">
        <CreateRoomCard />
        </div>
        <GameLobbyTable entries={entries} />
    </section>
    </main>
  );
}
