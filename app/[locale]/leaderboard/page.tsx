import {
  Globe2,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import LeaderboardTable from "@/components/leaderboardtable";
import { getLeaderboardEntries } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type LeaderBoardProps = {
  params: Promise<{
    locale: string;
  }>;
};

const friends = [
  ["Hoshi", "Online", "2,341"],
  ["RenjuMaster", "Online", "2,187"],
  ["Shirotora", "Online", "1,898"],
  ["Tenkei", "Offline", "1,756"],
  ["Mokuren", "Offline", "1,643"],
] as const;

const threads = [
  ["Hoshi", "Great game!", "2m"],
  ["RenjuMaster", "Game invite", "15m"],
  ["Shirotora", "Thanks!", "1h"],
  ["Tenkei", "See you next match.", "3h"],
] as const;

export default async function LeaderBoard({ params }: LeaderBoardProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, entries] = await Promise.all([
    getTranslations({ locale, namespace: "leaderboard" }),
    getLeaderboardEntries().catch(() => []),
  ]);

  return (
    <main className="app-shell app-shell-wide">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.62fr)_minmax(360px,0.38fr)]">
        <section className="command-panel min-h-[820px]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy aria-hidden="true" className="size-7 text-[var(--brass)]" />
              <div>
                <p className="eyebrow m-0">{t("eyebrow")}</p>
                <h1 className="font-serif text-4xl font-black">{t("title")}</h1>
              </div>
            </div>
            <div className="inline-flex rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-1">
              {["All Players", "Friends"].map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={`min-h-10 min-w-32 rounded-sm px-4 text-sm font-black ${
                    index === 0
                      ? "bg-[var(--mint-soft)] text-[var(--text)] shadow-[inset_0_0_0_1px_rgb(121_220_138_/_0.25)]"
                      : "text-[var(--muted-text)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-4 text-sm font-black text-[var(--muted-strong)]"
            >
              <Globe2 aria-hidden="true" className="size-4" />
              Global
            </button>
          </div>

          <LeaderboardTable entries={entries} />

          <div className="mt-5 rounded-md border border-[var(--brass)]/35 bg-[linear-gradient(90deg,rgba(214,173,98,0.16),rgba(255,255,255,0.03))] p-4">
            <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_repeat(3,110px)] md:items-center">
              <div>
                <p className="m-0 text-xs font-black tracking-[0.16em] text-[var(--muted-text)] uppercase">
                  Your Rank
                </p>
                <p className="m-0 font-serif text-4xl font-black text-[var(--brass)]">3</p>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-14 place-items-center rounded-full border border-[var(--brass)]/45 bg-white/[0.08] font-black">
                  K
                </span>
                <div>
                  <p className="m-0 text-xl font-black">Kuroishi</p>
                  <p className="m-0 text-sm text-[var(--brass)]">1,842 rating</p>
                </div>
              </div>
              <MiniMetric label="Wins" value="254" />
              <MiniMetric label="Losses" value="81" />
              <MiniMetric label="Win Rate" value="75.8%" />
            </div>
          </div>

          <p className="mt-5 text-sm text-[var(--muted-text)]">
            Ratings update in real time. Top 100 refreshed every 5 minutes.
          </p>
        </section>

        <aside className="grid content-start gap-5">
          <section className="command-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users aria-hidden="true" className="size-5 text-[var(--brass)]" />
                <h2 className="font-serif text-2xl font-bold">Friends</h2>
              </div>
              <button type="button" className="inline-flex items-center gap-2 text-sm font-bold">
                <Plus aria-hidden="true" className="size-4" />
                Add Friend
              </button>
            </div>

            <div className="field-shell mb-4">
              <Search aria-hidden="true" className="size-4 text-[var(--muted-text)]" />
              <input
                className="text-input field-input h-10"
                placeholder="Search by username..."
                aria-label="Search friends"
              />
            </div>

            <div className="mb-3 grid grid-cols-3 text-center text-sm font-black">
              {["Friends", "Pending", "Sent"].map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={`min-h-10 border-b-2 ${
                    index === 0
                      ? "border-[var(--mint)] text-[var(--text)]"
                      : "border-transparent text-[var(--muted-text)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              {friends.map(([name, state, rating]) => (
                <div
                  key={name}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-2.5"
                >
                  <span className="grid size-10 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.08] text-sm font-black">
                    {name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate font-black">{name}</p>
                    <p
                      className={`m-0 text-xs ${state === "Online" ? "text-[var(--mint)]" : "text-[var(--muted-text)]"}`}
                    >
                      {state}
                    </p>
                  </div>
                  <span className="text-sm font-black tabular-nums">{rating}</span>
                  <IconButton label={`Challenge ${name}`} icon={Swords} />
                  <IconButton label={`Remove ${name}`} icon={Trash2} />
                </div>
              ))}
            </div>
          </section>

          <section className="command-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare aria-hidden="true" className="size-5 text-[var(--brass)]" />
                <h2 className="font-serif text-2xl font-bold">Messages</h2>
              </div>
              <MoreVertical aria-hidden="true" className="size-5 text-[var(--muted-text)]" />
            </div>

            <div className="grid gap-2">
              {threads.map(([name, message, time], index) => (
                <div
                  key={`${name}-${time}`}
                  className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] p-3 ${
                    index === 0 ? "bg-[var(--mint-soft)]" : "bg-white/[0.035]"
                  }`}
                >
                  <span className="grid size-10 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.08] text-sm font-black">
                    {name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate font-black">{name}</p>
                    <p className="m-0 truncate text-xs text-[var(--muted-text)]">{message}</p>
                  </div>
                  <span className="text-xs font-bold text-[var(--muted-text)]">{time}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-xl font-black tabular-nums">{value}</p>
      <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{label}</p>
    </div>
  );
}

function IconButton({ label, icon: Icon }: { label: string; icon: typeof Swords }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-9 place-items-center rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] text-[var(--muted-strong)]"
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
