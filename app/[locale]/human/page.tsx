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
