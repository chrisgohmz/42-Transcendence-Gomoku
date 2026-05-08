import { RefreshCcw, Users } from "lucide-react";
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
      <section className="command-panel mb-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">Vs Human</p>
            <h1 className="page-title">Find a room or open your own.</h1>
            <p className="lede">
              A denser lobby for quick reads: room state, passwords, and join actions stay in one
              scan line.
            </p>
          </div>
          <div className="kpi-card min-w-44">
            <Users aria-hidden="true" className="mb-4 size-5 text-[var(--mint)]" />
            <div className="kpi-value text-[var(--mint)]">8</div>
            <p className="mt-2 text-sm text-[var(--muted-text)]">Players Looking</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
        <CreateRoomCard />
        <section className="surface-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Lobby</p>
              <h2 className="font-serif text-3xl font-bold">Room List</h2>
            </div>
            <button type="button" className="btn btn-subtle m-0 min-h-0 px-3 py-2 text-xs">
              <RefreshCcw aria-hidden="true" className="size-4" />
              Refresh
            </button>
          </div>
          <GameLobbyTable entries={entries} />
        </section>
      </section>
    </main>
  );
}
