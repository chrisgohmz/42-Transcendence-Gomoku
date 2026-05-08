import { Flag, RotateCcw, Settings, StepBack } from "lucide-react";

import GomokuBoard from "@/components/gomoku-board";
import PlayerBar from "@/components/player-bar";

const moveHistory = [
  ["41", "H8", "black"],
  ["42", "G8", "white"],
  ["43", "F7", "black"],
  ["44", "F8", "white"],
  ["45", "E8", "black"],
  ["46", "D8", "white"],
  ["47", "D7", "black"],
] as const;

export default function GamePage() {
  const blackStone = "radial-gradient(circle at 32% 28%, #4a463d 0 8%, #12100d 36%, #030303 100%)";
  const whiteStone = "radial-gradient(circle at 34% 28%, #fffdf5 0 18%, #e8dfcf 54%, #a99f90 100%)";

  return (
    <main className="app-shell app-shell-wide">
      <section className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="surface-panel content-start xl:order-none">
          <p className="eyebrow">Match Controls</p>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            {[
              { icon: StepBack, label: "Undo", helper: "Return a move" },
              { icon: RotateCcw, label: "Restart", helper: "New match" },
              { icon: Flag, label: "Resign", helper: "Concede" },
              { icon: Settings, label: "Settings", helper: "Board & sound" },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  className="rounded-md border border-[var(--panel-border-soft)] bg-white/[0.04] p-4 text-left transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-[var(--brass)]/45 hover:bg-white/[0.08] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
                >
                  <Icon aria-hidden="true" className="mb-4 size-6 text-[var(--muted-strong)]" />
                  <span className="block font-bold">{item.label}</span>
                  <span className="text-xs text-[var(--muted-text)]">{item.helper}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="surface-panel">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="flex items-center gap-3">
              <span
                className="h-14 w-14 rounded-full border border-[var(--brass)]/30 shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]"
                style={{ background: blackStone }}
                aria-hidden="true"
              />
              <div>
                <p className="text-xl font-black">Kuroaki</p>
                <p className="text-sm text-[var(--muted-text)]">
                  <span className="text-[var(--brass)]">五段</span> · 1867
                </p>
              </div>
            </div>

            <div className="rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-8 py-3 text-center">
              <p className="text-xs font-bold tracking-[0.18em] text-[var(--muted-strong)] uppercase">
                Turn
              </p>
              <p className="text-4xl font-black text-[var(--mint)] tabular-nums">01:32</p>
            </div>

            <div className="flex items-center gap-3 md:justify-end md:text-right">
              <div>
                <p className="text-xl font-black">Shiroyasha</p>
                <p className="text-sm text-[var(--muted-text)]">
                  <span className="text-[var(--brass)]">四段</span> · 1724
                </p>
              </div>
              <span
                className="h-14 w-14 rounded-full border border-white/55 shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]"
                style={{ background: whiteStone }}
                aria-hidden="true"
              />
            </div>
          </div>

          <GomokuBoard interactive className="mx-auto w-full max-w-[min(76vh,760px)]" />

          <PlayerBar blackName="Player 1" whiteName="Player 2" timer="10:00" />
        </section>

        <aside className="surface-panel content-start">
          <div>
            <p className="eyebrow">Match Info</p>
            <h1 className="font-serif text-2xl font-bold">Room 1024</h1>
          </div>

          <div className="grid gap-3 text-sm">
            {[
              ["Mode", "Ranked Match"],
              ["Rules", "15 x 15 / Standard"],
              ["Spectators", "3"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-[var(--panel-border-soft)] pb-3"
              >
                <span className="text-[var(--muted-text)]">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="label">Move History</p>
            <div className="grid gap-2">
              {moveHistory.map(([move, position, color]) => (
                <div
                  key={move}
                  className="grid grid-cols-[auto_auto_1fr] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3 py-2"
                >
                  <span className="text-xs text-[var(--muted-text)] tabular-nums">{move}</span>
                  <span
                    className="h-5 w-5 rounded-full border border-white/35 shadow-[inset_-4px_-5px_8px_rgba(0,0,0,0.28),inset_2px_2px_5px_rgba(255,255,255,0.22)]"
                    style={{ background: color === "black" ? blackStone : whiteStone }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold tabular-nums">{position}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] p-4">
            <p className="label">Game Status</p>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" />
              <span className="font-bold text-[var(--mint)]">In Progress</span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-text)]">Black to move.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
