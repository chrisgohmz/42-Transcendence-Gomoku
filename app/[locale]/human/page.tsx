import { RefreshCcw, Swords, Users } from "lucide-react";
import { setRequestLocale } from "next-intl/server";

import CreateRoomCard from "@/components/create-room-card";
import GameLobbyTable from "@/components/game-lobby-table";
import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";

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
    <PageShell>
      <PageHeader
        eyebrow="vs Human Lobby"
        icon={Swords}
        title="Find a room or open your own."
        lede="Create a ranked table, join a public room, or unlock a private duel without leaving the lobby view."
        actions={
          <>
            <Badge tone="mint">
              <Users aria-hidden="true" className="size-3.5" />8 looking
            </Badge>
            <button type="button" className="btn btn-subtle m-0 min-h-11 px-4">
              <RefreshCcw aria-hidden="true" className="size-4" />
              Refresh
            </button>
          </>
        }
      />

      <div className="mb-5 flex max-w-full overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1 sm:inline-flex">
        {["Lobby", "My Room", "History"].map((item, index) => (
          <button
            key={item}
            type="button"
            className={`min-h-10 min-w-32 rounded-sm px-4 text-sm font-black ${
              index === 0 ? "bg-[var(--mint-soft)] text-[var(--mint)]" : "text-[var(--muted-text)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="grid content-start gap-5">
          <CreateRoomCard />
          <MetricCard icon={Users} label="Players Looking" tone="mint" value="8" />
        </aside>

        <Surface eyebrow="Lobby" title="Room List">
          <GameLobbyTable entries={entries} />
        </Surface>
      </section>
    </PageShell>
  );
}
