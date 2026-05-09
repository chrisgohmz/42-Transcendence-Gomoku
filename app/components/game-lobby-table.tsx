import { ChevronRight, LockKeyhole, Radio, UnlockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/gomoku-ui";

type LobbyEntry = {
  roomId: number;
  player: string;
  requiresPassword: boolean;
};

type GameLobbyTableProps = {
  entries: LobbyEntry[];
};

const fallbackRows = [
  { id: 3, name: "Strong Path", players: "2/2", privacy: "Public", state: "Live", ping: "24ms" },
  { id: 4, name: "Five Stones", players: "1/2", privacy: "Public", state: "Waiting", ping: "31ms" },
  { id: 5, name: "Study Room", players: "1/2", privacy: "Private", state: "Waiting", ping: "42ms" },
  {
    id: 6,
    name: "Quiet Fuseki",
    players: "1/2",
    privacy: "Public",
    state: "Waiting",
    ping: "36ms",
  },
] as const;

export default function GameLobbyTable({ entries }: GameLobbyTableProps) {
  const t = useTranslations("human.lobby");
  const rows =
    entries.length > 0
      ? entries.map((entry) => ({
          id: entry.roomId,
          name: t("roomName", { player: entry.player }),
          ping: entry.roomId % 2 === 0 ? "28ms" : "45ms",
          players: entry.requiresPassword ? "1/2" : "2/2",
          privacy: entry.requiresPassword ? "Private" : "Public",
          state: entry.requiresPassword ? "Waiting" : "Live",
        }))
      : fallbackRows;

  return (
    <div
      className="overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]"
      data-testid="game-lobby-table"
    >
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[minmax(180px,1.25fr)_90px_88px_98px_78px_72px] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
          <span>Room</span>
          <span>Rules</span>
          <span>Players</span>
          <span>Privacy</span>
          <span>Ping</span>
          <span />
        </div>
        {rows.map((row) => (
          <article
            key={row.id}
            className="grid min-h-16 grid-cols-[minmax(180px,1.25fr)_90px_88px_98px_78px_72px] items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 last:border-b-0 hover:bg-white/[0.05]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`size-2.5 rounded-full ${row.state === "Live" ? "bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" : "bg-[var(--brass)]"}`}
              />
              <span className="min-w-0">
                <span className="block truncate font-black">{row.name}</span>
                <span className="block truncate text-xs text-[var(--muted-text)]">
                  Standard opening, ranked room
                </span>
              </span>
            </div>
            <span className="text-sm font-bold text-[var(--muted-strong)]">15 x 15</span>
            <span className="font-black tabular-nums">{row.players}</span>
            <Badge tone={row.privacy === "Public" ? "mint" : "neutral"}>
              {row.privacy === "Public" ? (
                <UnlockKeyhole aria-hidden="true" className="size-3.5" />
              ) : (
                <LockKeyhole aria-hidden="true" className="size-3.5" />
              )}
              {row.privacy}
            </Badge>
            <span className="text-sm font-black text-[var(--brass)] tabular-nums">{row.ping}</span>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] text-[var(--muted-strong)] hover:bg-white/[0.07]"
              aria-label={`Join ${row.name}`}
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </article>
        ))}
        <div className="flex items-center gap-2 border-t border-[var(--panel-border-soft)] px-4 py-3 text-sm font-bold text-[var(--muted-text)]">
          <Radio aria-hidden="true" className="size-4 text-[var(--mint)]" />
          Room list refreshes every few seconds while the realtime service is connected.
        </div>
      </div>
    </div>
  );
}
