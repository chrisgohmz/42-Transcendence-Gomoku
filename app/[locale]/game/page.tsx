import { BrainCircuit, Flag, Gauge, RotateCcw, Settings, StepBack, Zap } from "lucide-react";

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

const controls = [
  { icon: StepBack, label: "Undo", helper: "Return one move" },
  { icon: RotateCcw, label: "Restart", helper: "New AI line" },
  { icon: Flag, label: "Resign", helper: "Concede match" },
  { icon: Settings, label: "Rules", helper: "Board & sound" },
] as const;

export default function GamePage() {
  const blackStone = "radial-gradient(circle at 32% 28%, #4a463d 0 8%, #12100d 36%, #030303 100%)";
  const whiteStone = "radial-gradient(circle at 34% 28%, #fffdf5 0 18%, #e8dfcf 54%, #a99f90 100%)";

  return (
    <main className="app-shell app-shell-wide">
      <section className="grid gap-5 2xl:grid-cols-[250px_minmax(0,1fr)_300px]">
        <aside className="grid content-start gap-4">
          <section className="command-panel">
            <p className="label">AI Opponent</p>
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)]">
                <BrainCircuit aria-hidden="true" className="size-6 text-[var(--mint)]" />
              </span>
              <div>
                <h1 className="font-serif text-2xl font-bold">Kata Reader</h1>
                <p className="m-0 text-sm text-[var(--muted-text)]">Depth 6 / Calm tempo</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="kpi-card">
                <Gauge aria-hidden="true" className="mb-3 size-5 text-[var(--brass)]" />
                <div className="kpi-value text-[var(--brass)]">72%</div>
                <p className="mt-2 text-sm text-[var(--muted-text)]">Position confidence</p>
              </div>
              <div className="kpi-card">
                <Zap aria-hidden="true" className="mb-3 size-5 text-[var(--mint)]" />
                <div className="kpi-value text-[var(--mint)]">+14</div>
                <p className="mt-2 text-sm text-[var(--muted-text)]">Initiative swing</p>
              </div>
            </div>
          </section>

          <section className="command-panel">
            <p className="label">Controls</p>
            <div className="grid gap-2">
              {controls.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className="sidebar-link w-full justify-start"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    <span className="min-w-0 text-left">
                      <span className="block">{item.label}</span>
                      <span className="block text-xs font-semibold text-[var(--muted-text)]">
                        {item.helper}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="board-room">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <PlayerPlate name="Kuroaki" rank="五段" rating="1867" stone={blackStone} />
            <div className="rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-8 py-3 text-center">
              <p className="m-0 text-xs font-bold tracking-[0.18em] text-[var(--muted-strong)] uppercase">
                Black to Move
              </p>
              <p className="m-0 text-4xl font-black text-[var(--mint)] tabular-nums">01:32</p>
            </div>
            <PlayerPlate
              name="Shiroyasha"
              rank="四段"
              rating="1724"
              stone={whiteStone}
              align="end"
            />
          </div>

          <GomokuBoard interactive className="mx-auto w-full max-w-[min(76vh,820px)]" />

          <PlayerBar blackName="Player 1" whiteName="Player 2" timer="10:00" />
        </section>

        <aside className="grid content-start gap-4">
          <section className="command-panel">
            <p className="label">Room 1024</p>
            <h2 className="font-serif text-3xl font-bold">Ranked Match</h2>
            <div className="mt-5 grid gap-3 text-sm">
              {[
                ["Rules", "15 x 15 / Standard"],
                ["Spectators", "3"],
                ["Capture", "Disabled"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--muted-text)]">{label}</span>
                  <span className="font-black">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="command-panel">
            <p className="label">Move History</p>
            <div className="grid gap-2">
              {moveHistory.map(([move, position, color]) => (
                <div
                  key={move}
                  className="grid grid-cols-[auto_auto_1fr] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.04] px-3 py-2"
                >
                  <span className="text-xs text-[var(--muted-text)] tabular-nums">{move}</span>
                  <span
                    className="h-5 w-5 rounded-full border border-white/35 shadow-[inset_-4px_-5px_8px_rgba(0,0,0,0.28),inset_2px_2px_5px_rgba(255,255,255,0.22)]"
                    style={{ background: color === "black" ? blackStone : whiteStone }}
                    aria-hidden="true"
                  />
                  <span className="font-black tabular-nums">{position}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function PlayerPlate({
  name,
  rank,
  rating,
  stone,
  align = "start",
}: {
  name: string;
  rank: string;
  rating: string;
  stone: string;
  align?: "start" | "end";
}) {
  return (
    <div
      className={`flex items-center gap-3 ${align === "end" ? "md:flex-row-reverse md:text-right" : ""}`}
    >
      <span
        className="h-14 w-14 rounded-full border border-[var(--brass)]/30 shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]"
        style={{ background: stone }}
        aria-hidden="true"
      />
      <div>
        <p className="m-0 text-xl font-black">{name}</p>
        <p className="m-0 text-sm text-[var(--muted-text)]">
          <span className="text-[var(--brass)]">{rank}</span> / {rating}
        </p>
      </div>
    </div>
  );
}
