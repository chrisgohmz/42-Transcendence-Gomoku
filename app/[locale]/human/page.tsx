import { setRequestLocale } from "next-intl/server";

import CreateRoomCard from "@/components/create-room-card";
import GameLobbyTable from "@/components/game-lobby-table";

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

type VsHumanProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function VsHuman({ params }: VsHumanProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="app-shell app-shell-wide">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Vs Human</p>
          <h1 className="page-title">Find a room or open your own.</h1>
        </div>
        <div className="rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-4 py-2 text-sm font-bold text-[var(--mint)]">
          8 Players Looking
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
        <div>
          <CreateRoomCard />
        </div>
        <section className="surface-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Lobby</p>
              <h2 className="font-serif text-3xl font-bold">Room List</h2>
            </div>
            <button type="button" className="btn btn-subtle m-0 min-h-0 px-3 py-2 text-xs">
              Refresh
            </button>
          </div>
          <GameLobbyTable entries={entries} />
        </section>
      </section>
    </main>
  );
}
