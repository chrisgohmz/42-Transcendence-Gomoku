import { Bot, ChevronRight, Clock3, MessageSquare, Swords, Trophy, Users } from "lucide-react";
import Image from "next/image";

import GomokuBoard from "@/components/gomoku-board";
import { Link } from "@/i18n/navigation";

const activity = [
  { actor: "Kuroaki", detail: "defeated Shiroyasha", time: "2m" },
  { actor: "Sakura", detail: "reached 5 in a row", time: "15m" },
  { actor: "RenjuMaster", detail: "opened a public room", time: "1h" },
] as const;

export default function HomeDashboard() {
  return (
    <main className="app-shell app-shell-wide">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)_minmax(320px,0.7fr)]">
        <aside className="surface-panel content-start">
          <div className="flex items-center gap-3">
            <Image src="/icons/Gomoku.svg" alt="" width={54} height={54} className="rounded-lg" />
            <div>
              <p className="eyebrow mb-1">Transcendence</p>
              <h1 className="font-serif text-2xl font-bold tracking-normal text-pretty">
                五目並べヒーロー
              </h1>
            </div>
          </div>

          <div className="relative mt-3 overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#050807] p-4">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent" />
            <p className="max-w-[18rem] font-serif text-4xl leading-tight text-pretty">
              Master the board. Transcend the ladder.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-text)]">
              Play focused Gomoku matches, climb ratings, and keep your circle close.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="surface-card">
              <Users aria-hidden="true" className="size-5 text-[var(--mint)]" />
              <div className="mt-3 text-3xl font-black tabular-nums">1,284</div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">Players Online</p>
            </div>
            <div className="surface-card">
              <Clock3 aria-hidden="true" className="size-5 text-[var(--brass)]" />
              <div className="mt-3 text-3xl font-black tabular-nums">42</div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">Waiting Rooms</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Link
              href="/game"
              className="surface-card group flex min-h-36 flex-col justify-between border-[var(--mint)]/35 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--mint)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
            >
              <Bot aria-hidden="true" className="size-8 text-[var(--mint)]" />
              <div>
                <h2 className="text-lg font-bold">vs AI</h2>
                <p className="mt-1 text-sm text-[var(--muted-text)]">Practice reading shapes.</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mint)]">
                Play <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            </Link>

            <Link
              href="/human"
              className="surface-card group flex min-h-36 flex-col justify-between border-[var(--lacquer)]/45 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--lacquer)] focus-visible:ring-3 focus-visible:ring-[var(--lacquer)]/25 focus-visible:outline-none"
            >
              <Swords aria-hidden="true" className="size-8 text-[var(--lacquer)]" />
              <div>
                <h2 className="text-lg font-bold">vs Human</h2>
                <p className="mt-1 text-sm text-[var(--muted-text)]">Challenge real players.</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#ff8b84]">
                Play <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            </Link>
          </div>
        </aside>

        <section className="surface-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Active Game</p>
              <h2 className="font-serif text-3xl font-bold text-pretty">Kuroaki vs Shiroyasha</h2>
            </div>
            <div className="rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-4 py-2 text-center">
              <p className="text-xs font-bold tracking-[0.18em] text-[var(--muted-strong)] uppercase">
                Turn
              </p>
              <p className="text-3xl font-black text-[var(--mint)] tabular-nums">01:32</p>
            </div>
          </div>

          <GomokuBoard className="mx-auto w-full max-w-[min(72vh,720px)]" />

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Undo", "Return a move"],
              ["Restart", "New match"],
              ["Flag", "Resign"],
              ["Settings", "Rules & sound"],
            ].map(([label, helper]) => (
              <button
                key={label}
                type="button"
                className="rounded-md border border-[var(--panel-border-soft)] bg-white/5 px-3 py-3 text-left transition-[background-color,border-color] hover:border-[var(--brass)]/45 hover:bg-white/[0.08] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
              >
                <span className="block font-bold">{label}</span>
                <span className="text-xs text-[var(--muted-text)]">{helper}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="surface-panel content-start">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Lobby</p>
              <h2 className="font-serif text-2xl font-bold">Rooms</h2>
            </div>
            <Link href="/human" className="text-link text-sm">
              Browse
            </Link>
          </div>

          <div className="surface-card grid gap-3">
            <label className="field-label" htmlFor="home-room-name">
              Room Name
            </label>
            <input
              id="home-room-name"
              name="roomName"
              autoComplete="off"
              className="text-input"
              placeholder="Ranked 15 x 15…"
            />
            <Link href="/human" className="btn btn-danger w-full text-center">
              Create Room
            </Link>
          </div>

          <div className="grid gap-2">
            {["Strong Path", "Five Stones", "Study Room", "GoGoGomoku"].map((room, index) => (
              <div
                key={room}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{room}</p>
                  <p className="text-xs text-[var(--muted-text)]">15 x 15 / Standard</p>
                </div>
                <span className="rounded border border-[var(--mint)]/35 px-2 py-1 text-xs font-bold text-[var(--mint)]">
                  {index % 2 === 0 ? "Public" : "Private"}
                </span>
                <Link
                  aria-label={`Join ${room}`}
                  href="/human"
                  className="grid size-9 place-items-center rounded-md border border-[var(--panel-border-soft)] hover:border-[var(--mint)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            ))}
          </div>

          <div className="surface-card">
            <div className="mb-3 flex items-center gap-2">
              <Trophy aria-hidden="true" className="size-5 text-[var(--brass)]" />
              <h2 className="font-bold">Recent Signals</h2>
            </div>
            <div className="grid gap-3">
              {activity.map((item) => (
                <div
                  key={`${item.actor}-${item.time}`}
                  className="grid grid-cols-[auto_1fr_auto] gap-3"
                >
                  <span className="mt-1 size-2 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" />
                  <p className="min-w-0 text-sm text-[var(--muted-text)]">
                    <span className="font-semibold text-[var(--text)]">{item.actor}</span>{" "}
                    {item.detail}
                  </p>
                  <span className="text-xs text-[var(--muted-text)]">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/messages"
            className="surface-card flex items-center justify-between transition-[border-color] hover:border-[var(--mint)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
          >
            <span className="inline-flex items-center gap-3 font-bold">
              <MessageSquare aria-hidden="true" className="size-5 text-[var(--mint)]" />
              Messages
            </span>
            <span className="rounded-full bg-[var(--lacquer)] px-2 py-0.5 text-xs font-bold">
              3
            </span>
          </Link>
        </aside>
      </section>
    </main>
  );
}
