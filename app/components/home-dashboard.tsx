import {
  Bot,
  BookOpen,
  ChevronRight,
  Clock3,
  Flag,
  Home,
  MessageSquare,
  Plus,
  Radio,
  RotateCcw,
  Settings,
  Swords,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import GomokuBoard from "@/components/gomoku-board";
import { Link } from "@/i18n/navigation";

const stats = [
  { icon: Users, label: "Players Online", value: "1,284", tone: "text-[var(--mint)]" },
  { icon: Clock3, label: "Waiting Rooms", value: "42", tone: "text-[var(--brass)]" },
] as const;

const quickLinks = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/game", icon: Bot, label: "vs AI" },
  { href: "/human", icon: Swords, label: "vs Human" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "https://en.wikipedia.org/wiki/Gomoku", icon: BookOpen, label: "Rules" },
] as const;

const moveHistory = [
  ["41", "H8", "black"],
  ["42", "G8", "white"],
  ["43", "F7", "black"],
  ["44", "F8", "white"],
  ["45", "E8", "black"],
  ["46", "D8", "white"],
  ["47", "D7", "black"],
] as const;

const rooms = [
  ["Strong Path", "15 x 15", "2/2", "public", "live"],
  ["Five Stones", "15 x 15", "1/2", "public", "waiting"],
  ["Study Room", "15 x 15", "1/2", "private", "waiting"],
  ["GoGoGomoku", "15 x 15", "2/2", "public", "live"],
  ["Quiet Fuseki", "15 x 15", "1/2", "public", "live"],
] as const;

const controls = [
  { icon: RotateCcw, label: "Return" },
  { icon: Radio, label: "Replay" },
  { icon: Flag, label: "Resign" },
  { icon: Settings, label: "Settings" },
] as const;

const blackStone = "radial-gradient(circle at 32% 28%, #4a463d 0 8%, #12100d 36%, #030303 100%)";
const whiteStone = "radial-gradient(circle at 34% 28%, #fffdf5 0 18%, #e8dfcf 54%, #a99f90 100%)";

export default function HomeDashboard() {
  return (
    <main className="app-shell app-shell-wide">
      <section className="grid gap-5 2xl:grid-cols-[0.82fr_1.12fr_0.86fr]">
        <section className="command-panel min-h-[760px]">
          <PanelLabel>Home Dashboard</PanelLabel>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Image src="/icons/Gomoku.svg" alt="Gomoku" width={44} height={44} priority />
              <div className="min-w-0">
                <p className="m-0 truncate text-lg font-black" translate="no">
                  Gomoku
                </p>
                <p className="m-0 text-[0.65rem] font-black tracking-[0.26em] text-[var(--brass)] uppercase">
                  Transcendence
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full border border-[var(--panel-border)] bg-white/[0.05]">
                <UserRound aria-hidden="true" className="size-4 text-[var(--muted-strong)]" />
              </span>
              <span className="size-2.5 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" />
            </div>
          </div>

          <nav className="mt-5 grid grid-cols-5 gap-1 border-y border-[var(--panel-border-soft)] py-1.5">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="grid min-h-10 place-items-center gap-1 rounded-md text-center text-[0.62rem] font-black text-[var(--muted-strong)] no-underline transition-colors hover:bg-white/[0.06] hover:text-[var(--text)]"
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[radial-gradient(circle_at_70%_20%,rgba(214,173,98,0.18),transparent_32%),linear-gradient(135deg,rgba(198,56,47,0.15),transparent_34%),rgba(3,6,5,0.62)] p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.82fr)_minmax(180px,0.68fr)] md:items-center">
              <div>
                <h1 className="max-w-[10ch] font-serif text-4xl leading-[1] font-black text-pretty">
                  Master the board.
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted-strong)]">
                  Transcend every rival with one clean five-stone line.
                </p>
              </div>
              <GomokuBoard className="mx-auto w-full max-w-[185px] rotate-2 shadow-[0_26px_65px_rgba(0,0,0,0.54)]" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.label}
                  className="rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3"
                >
                  <Icon aria-hidden="true" className={`mb-2 size-5 ${item.tone}`} />
                  <div className="text-2xl font-black tabular-nums">{item.value}</div>
                  <p className="m-0 text-sm font-semibold text-[var(--muted-text)]">{item.label}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <ActionCard
              href="/game"
              icon={Bot}
              title="vs AI"
              body="Practice sharp lines against Kata Reader."
              cta="Play"
              tone="mint"
            />
            <ActionCard
              href="/human"
              icon={Swords}
              title="vs Human"
              body="Challenge real players worldwide."
              cta="Play"
              tone="red"
            />
          </div>

          <div className="mt-4 grid grid-cols-4 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
            {[
              { href: "/leaderboard", icon: Trophy, label: "Ladder" },
              { href: "/friends", icon: Users, label: "Friends", badge: "12" },
              { href: "/messages", icon: MessageSquare, label: "Messages", badge: "3" },
              { href: "/profile", icon: UserRound, label: "Profile" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="relative grid min-h-14 place-items-center gap-1 border-r border-[var(--panel-border-soft)] p-2 text-center text-[0.68rem] font-bold text-[var(--muted-text)] no-underline last:border-r-0 hover:bg-white/[0.05]"
                >
                  <Icon aria-hidden="true" className="size-4 text-[var(--muted-strong)]" />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="absolute top-2 right-3 rounded-full bg-[var(--lacquer)] px-1.5 py-0.5 text-[0.62rem] text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="command-panel min-h-[760px]">
          <PanelLabel>Active Game</PanelLabel>

          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <PlayerPlate name="Kuroaki" rank="5-dan" rating="1867" stone={blackStone} />
              <div className="rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-5 py-2 text-center">
                <p className="m-0 text-[0.65rem] font-black tracking-[0.18em] text-[var(--muted-strong)] uppercase">
                  Turn
                </p>
                <p className="m-0 text-4xl leading-none font-black text-[var(--mint)] tabular-nums">
                  01:32
                </p>
              </div>
              <PlayerPlate
                name="Shiroyasha"
                rank="4-dan"
                rating="1724"
                stone={whiteStone}
                align="end"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_118px]">
              <GomokuBoard
                interactive
                className="mx-auto w-full max-w-[min(58vh,610px)] rounded-[0.38rem]"
              />
              <aside className="grid content-start gap-4 rounded-md border border-[var(--panel-border-soft)] bg-black/20 p-3">
                <div>
                  <p className="label m-0">Match Info</p>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--muted-text)]">
                    <span>Room 1024</span>
                    <span>Ranked Match</span>
                    <span>15 x 15 / Standard</span>
                    <span>3 spectators</span>
                  </div>
                </div>
                <div className="split-line" />
                <div>
                  <p className="label m-0">Move History</p>
                  <div className="mt-3 grid gap-1.5">
                    {moveHistory.map(([move, position, color]) => (
                      <div
                        key={move}
                        className={`grid grid-cols-[auto_auto_1fr] items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${
                          move === "47"
                            ? "bg-[var(--mint-soft)] text-[var(--mint)]"
                            : "bg-white/[0.035]"
                        }`}
                      >
                        <span className="text-[var(--muted-text)] tabular-nums">{move}</span>
                        <span
                          className="size-4 rounded-full border border-white/30"
                          style={{ background: color === "black" ? blackStone : whiteStone }}
                          aria-hidden="true"
                        />
                        <span className="font-black tabular-nums">{position}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            <div className="grid grid-cols-4 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
              {controls.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className="grid min-h-16 place-items-center gap-1 border-r border-[var(--panel-border-soft)] text-xs font-bold text-[var(--muted-strong)] last:border-r-0 hover:bg-white/[0.05]"
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="command-panel min-h-[760px]">
          <PanelLabel>vs Human Lobby</PanelLabel>

          <div className="mt-4 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-md border border-[var(--lacquer)]/35 bg-[rgb(198_56_47_/_0.16)]">
              <Swords aria-hidden="true" className="size-6 text-[var(--danger)]" />
            </span>
            <div>
              <h2 className="font-serif text-2xl font-bold">vs Human</h2>
              <p className="m-0 text-sm text-[var(--muted-text)]">
                Public rooms and private duels.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 border-b border-[var(--panel-border-soft)] text-center text-sm font-black">
            {["Lobby", "My Room", "History"].map((item, index) => (
              <button
                key={item}
                type="button"
                className={`min-h-11 border-b-2 ${
                  index === 0
                    ? "border-[var(--lacquer)] text-[var(--text)]"
                    : "border-transparent text-[var(--muted-text)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <section className="mt-5 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-serif text-xl font-bold">Create Room</h3>
              <span className="text-xs font-black text-[var(--brass)]">15 x 15</span>
            </div>
            <div className="grid gap-3">
              <input className="text-input" placeholder="Room name" aria-label="Room name" />
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <input
                  className="text-input"
                  placeholder="Password optional"
                  aria-label="Password optional"
                />
                <button type="button" className="btn btn-danger m-0 px-4">
                  <Plus aria-hidden="true" className="size-4" />
                  Room
                </button>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025] p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-serif text-xl font-bold">Room List</h3>
              <button
                type="button"
                className="rounded-md border border-[var(--panel-border-soft)] px-2 py-1 text-xs font-bold text-[var(--muted-text)]"
              >
                Refresh
              </button>
            </div>

            <div className="grid gap-1 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
              <div className="grid grid-cols-[minmax(0,1fr)_48px_42px_54px_30px] gap-2 border-b border-[var(--panel-border-soft)] pb-2">
                <span>Room</span>
                <span>Rule</span>
                <span>Ply</span>
                <span>Privacy</span>
                <span />
              </div>
            </div>
            <div className="grid">
              {rooms.map(([room, rules, occupancy, privacy, state]) => (
                <div
                  key={room}
                  className="grid min-h-12 grid-cols-[minmax(0,1fr)_48px_42px_54px_30px] items-center gap-2 border-b border-[var(--panel-border-soft)] text-sm last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2 font-bold">
                    <span
                      className={`size-2 rounded-full ${
                        state === "live" ? "bg-[var(--mint)]" : "bg-[#ffd35f]"
                      }`}
                    />
                    <span className="truncate">{room}</span>
                  </span>
                  <span className="text-[var(--muted-text)]">{rules}</span>
                  <span className="font-black tabular-nums">{occupancy}</span>
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 text-center text-xs font-black ${
                      privacy === "public"
                        ? "border-[var(--mint)]/35 text-[var(--mint)]"
                        : "border-[var(--panel-border)] text-[var(--muted-text)]"
                    }`}
                  >
                    {privacy === "public" ? "Open" : "Lock"}
                  </span>
                  <Link
                    href="/human"
                    className="grid size-8 place-items-center rounded-md border border-[var(--panel-border-soft)] text-[var(--muted-strong)] no-underline hover:bg-white/[0.06]"
                    aria-label={`Join ${room}`}
                  >
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-center text-sm font-black tracking-[0.2em] text-[var(--muted-strong)] uppercase">
      {children}
    </p>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  body,
  cta,
  tone,
}: {
  href: string;
  icon: typeof Bot;
  title: string;
  body: string;
  cta: string;
  tone: "mint" | "red";
}) {
  const toneClasses =
    tone === "mint"
      ? "border-[var(--mint)]/30 text-[var(--mint)]"
      : "border-[var(--lacquer)]/45 text-[var(--danger)]";
  const buttonClasses = tone === "mint" ? "btn-primary" : "btn-danger";

  return (
    <Link
      href={href}
      className={`grid min-h-32 gap-2 rounded-md border bg-white/[0.035] p-3 no-underline ${toneClasses}`}
    >
      <Icon aria-hidden="true" className="size-7" />
      <div>
        <h2 className="text-lg font-black text-[var(--text)]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-text)]">{body}</p>
      </div>
      <span className={`btn ${buttonClasses} m-0 min-h-9 justify-between px-3 py-1.5`}>
        {cta}
        <ChevronRight aria-hidden="true" className="size-4" />
      </span>
    </Link>
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
      className={`flex min-w-0 items-center gap-3 ${align === "end" ? "justify-end text-right" : ""}`}
    >
      {align === "start" ? <Stone background={stone} /> : null}
      <div className="min-w-0">
        <p className="m-0 truncate text-lg font-black">{name}</p>
        <p className="m-0 truncate text-sm text-[var(--muted-text)]">
          <span className="text-[var(--brass)]">{rank}</span> / {rating}
        </p>
      </div>
      {align === "end" ? <Stone background={stone} /> : null}
    </div>
  );
}

function Stone({ background }: { background: string }) {
  return (
    <span
      className="size-12 shrink-0 rounded-full border border-[var(--brass)]/30 shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]"
      style={{ background }}
      aria-hidden="true"
    />
  );
}
