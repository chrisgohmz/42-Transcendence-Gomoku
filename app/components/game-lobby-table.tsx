"use client";

import { ChevronRight, LockKeyhole, Radio, UnlockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/gomoku-ui";

export type LobbyEntry = {
  matchId?: string;
  roomId?: number;
  player: string;
  requiresPassword: boolean;
  playerCount?: number;
  status?: string;
  boardSize?: number;
};

type GameLobbyTableProps = {
  entries: LobbyEntry[];
  error?: string | null;
  isLoading?: boolean;
  joiningMatchId?: string | null;
  onJoin?: (entry: LobbyEntry) => void;
};

export default function GameLobbyTable({
  entries,
  error,
  isLoading = false,
  joiningMatchId,
  onJoin,
}: GameLobbyTableProps) {
  const t = useTranslations("human.lobby");
  const rows = entries.map((entry, index) => {
    const id = entry.matchId ?? String(entry.roomId ?? index);
    const isLive = entry.status ? entry.status !== "WAITING" : !entry.requiresPassword;
    const isPublic = !entry.requiresPassword;

    return {
      id,
      entry,
      name: t("roomName", { player: entry.player }),
      ping: entry.roomId && entry.roomId % 2 === 0 ? "28ms" : "45ms",
      players:
        typeof entry.playerCount === "number"
          ? `${entry.playerCount}/2`
          : entry.requiresPassword
            ? "1/2"
            : "2/2",
      privacy: isPublic ? t("privacy.public") : t("privacy.private"),
      isLive,
      isPublic,
      boardSize: entry.boardSize ?? 15,
    };
  });

  return (
    <div
      className="overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]"
      data-testid="game-lobby-table"
      aria-busy={isLoading}
    >
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[minmax(180px,1.25fr)_90px_88px_98px_78px_72px] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
          <span>{t("headers.room")}</span>
          <span>{t("headers.rules")}</span>
          <span>{t("headers.players")}</span>
          <span>{t("headers.privacy")}</span>
          <span>{t("headers.ping")}</span>
          <span />
        </div>
        {error ? (
          <div
            role="alert"
            className="border-b border-[var(--panel-border-soft)] px-4 py-3 text-sm font-bold text-[var(--danger)]"
          >
            {error}
          </div>
        ) : null}
        {rows.length > 0 ? (
          rows.map((row) => (
            <article
              key={row.id}
              className="grid min-h-16 grid-cols-[minmax(180px,1.25fr)_90px_88px_98px_78px_72px] items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 last:border-b-0 hover:bg-white/[0.05]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`size-2.5 rounded-full ${row.isLive ? "bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" : "bg-[var(--brass)]"}`}
                />
                <span className="min-w-0">
                  <span className="block truncate font-black">{row.name}</span>
                  <span className="block truncate text-xs text-[var(--muted-text)]">
                    {t("roomDescription")}
                  </span>
                </span>
              </div>
              <span className="text-sm font-bold text-[var(--muted-strong)]">
                {row.boardSize} x {row.boardSize}
              </span>
              <span className="font-black tabular-nums">{row.players}</span>
              <Badge tone={row.isPublic ? "mint" : "neutral"}>
                {row.isPublic ? (
                  <UnlockKeyhole aria-hidden="true" className="size-3.5" />
                ) : (
                  <LockKeyhole aria-hidden="true" className="size-3.5" />
                )}
                {row.privacy}
              </Badge>
              <span className="text-sm font-black text-[var(--brass)] tabular-nums">
                {row.ping}
              </span>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] text-[var(--muted-strong)] hover:bg-white/[0.07]"
                aria-label={t("joinAria", { name: row.name })}
                onClick={() => {
                  onJoin?.(row.entry);
                }}
                disabled={Boolean(joiningMatchId) || isLoading}
                aria-busy={joiningMatchId === row.id}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </article>
          ))
        ) : (
          <div className="border-b border-[var(--panel-border-soft)] px-4 py-6 text-sm font-bold text-[var(--muted-text)]">
            {t("empty")}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-[var(--panel-border-soft)] px-4 py-3 text-sm font-bold text-[var(--muted-text)]">
          <Radio aria-hidden="true" className="size-4 text-[var(--mint)]" />
          {t("footer")}
        </div>
      </div>
    </div>
  );
}
