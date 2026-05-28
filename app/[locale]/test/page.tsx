import CreateRoomCard from "@/components/create-room-card";
import GameLobbyTableClient from "@/components/game-lobby-table-client";
import { createPageMetadata } from "@/lib/page-metadata";

export const generateMetadata = createPageMetadata("test");

export default function TestPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-4xl space-y-8">
        <div className="mx-auto max-w-xl">
          <CreateRoomCard />
        </div>
        <GameLobbyTableClient entries={[]} />
      </section>
    </main>
  );
}
