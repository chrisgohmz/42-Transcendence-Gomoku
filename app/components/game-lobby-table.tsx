import { ChevronRight, LockKeyhole, Radio, UnlockKeyhole, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/gomoku-ui";

export type LobbyEntry = {
  matchId?: string;
  roomId?: number;
  name?: string | null;
  player: string;
  requiresPassword: boolean;
  playerCount?: number;
  status?: string;
  boardSize?: number;
};

export type GameLobbyTableProps = {
  entries: LobbyEntry[];
  error?: string | null;
  isLoading?: boolean;
  joiningMatchId?: string | null;
  onJoin?: (entry: LobbyEntry, password?: string) => void;
};

export default function GameLobbyTable({
  entries,
  error,
  isLoading = false,
  joiningMatchId,
  onJoin,
}: GameLobbyTableProps) {
  const t = useTranslations("human.lobby");

  const [passwordPrompt, setPasswordPrompt] = useState<LobbyEntry | null>(null);
  const [passwordInput, setPasswordInput] = useState("");

  const rows = entries.map((entry, index) => {
    const id = entry.matchId ?? String(entry.roomId ?? index);
    const state = entry.status
      ? entry.status === "WAITING"
        ? "Waiting"
        : "Live"
      : entry.requiresPassword
        ? "Waiting"
        : "Live";

    return {
      id,
      entry,
      name: entry.name || t("roomName", { player: entry.player }),
      ping: entry.roomId && entry.roomId % 2 === 0 ? "28ms" : "45ms",
      players:
        typeof entry.playerCount === "number"
          ? `${entry.playerCount}/2`
          : entry.requiresPassword
            ? "1/2"
            : "2/2",
      privacy: entry.requiresPassword ? "Private" : "Public",
      state,
      boardSize: entry.boardSize ?? 15,
    };
  });

  return (
    <>
      <div
        className="overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]"
        data-testid="game-lobby-table"
        aria-busy={isLoading}
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
          {error && !passwordPrompt ? (
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
                    className={`size-2.5 rounded-full ${row.state === "Live" ? "bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" : "bg-[var(--brass)]"}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-black">{row.name}</span>
                    <span className="block truncate text-xs text-[var(--muted-text)]">
                      Standard opening, ranked room
                    </span>
                  </span>
                </div>
                <span className="text-sm font-bold text-[var(--muted-strong)]">
                  {row.boardSize} x {row.boardSize}
                </span>
                <span className="font-black tabular-nums">{row.players}</span>
                <Badge tone={row.privacy === "Public" ? "mint" : "neutral"}>
                  {row.privacy === "Public" ? (
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
                  aria-label={`${t("join")} ${row.name}`}
                  onClick={() => {
                    if (row.entry.requiresPassword) {
                      setPasswordPrompt(row.entry);
                      setPasswordInput("");
                    } else {
                      onJoin?.(row.entry);
                    }
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
            Waiting rooms from the match service.
          </div>
        </div>
      </div>

      {passwordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--panel-border-soft)] bg-[#0e0e11] shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--panel-border-soft)] bg-white/[0.02] px-5 py-4">
              <h3 className="flex items-center gap-2 font-black text-white">
                <LockKeyhole aria-hidden="true" className="size-4 text-[var(--brass)]" />
                Private Room
              </h3>
              <button
                onClick={() => setPasswordPrompt(null)}
                className="rounded-md text-[var(--muted-text)] transition-colors hover:text-white"
                aria-label="Close"
                disabled={Boolean(joiningMatchId)}
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (passwordInput) {
                  onJoin?.(passwordPrompt, passwordInput);
                }
              }}
              className="p-5"
            >
              <p className="mb-4 text-sm leading-relaxed text-[var(--muted-text)]">
                Enter the password to join <strong className="text-white">{passwordPrompt.name || passwordPrompt.player}</strong>'s room.
              </p>

              {error ? (
                <p className="mb-4 rounded bg-[var(--danger)]/10 p-2 text-sm font-bold text-[var(--danger)]">
                  {error}
                </p>
              ) : null}

              <input
                type="password"
                autoFocus
                placeholder="Room password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="text-input mb-6 w-full"
                disabled={Boolean(joiningMatchId)}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordPrompt(null)}
                  className="rounded-md px-4 py-2 text-sm font-bold text-[var(--muted-text)] transition-colors hover:bg-white/[0.05] hover:text-white"
                  disabled={Boolean(joiningMatchId)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passwordInput || Boolean(joiningMatchId)}
                  className="min-h-10 rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)] px-5 text-sm font-black text-[var(--mint)] transition-colors hover:bg-[var(--mint)]/20 disabled:opacity-50"
                >
                  {joiningMatchId ? "Joining..." : "Join Game"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
