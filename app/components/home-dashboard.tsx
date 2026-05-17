import { Activity, Bot, Clock3, Radio, Swords, Trophy, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  ActionCard,
  Badge,
  BoardShowpiece,
  MetricCard,
  PageShell,
  Surface,
} from "@/components/gomoku-ui";
import { Link } from "@/i18n/navigation";

const snapshot = [
  ["1", "Hoshi", "2,341", "+18"],
  ["2", "RenjuMaster", "2,187", "+7"],
  ["3", "Kuroishi", "2,042", "+14"],
  ["4", "Shirotora", "1,898", "-2"],
] as const;

export default async function HomeDashboard() {
  const t = await getTranslations("home.dashboard");

  const activity = [
    { name: "Hoshi", event: t("activity.items.wonByOpenFour"), time: "2m" },
    { name: "RenjuMaster", event: t("activity.items.openedPrivateStudyRoom"), time: "7m" },
    { name: "Shirotora", event: t("activity.items.crossed1900Rating"), time: "18m" },
    { name: "Tenkei", event: t("activity.items.acceptedRematch"), time: "31m" },
  ] as const;

  return (
    <PageShell className="grid gap-5">
      <section className="command-panel overflow-hidden">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(430px,0.7fr)] xl:items-center">
          <div className="min-w-0">
            <Badge tone="mint">
              <Radio aria-hidden="true" className="size-3.5" />
              {t("status.onlinePlayers", { count: "1,284" })}
            </Badge>
            <h1 className="mt-6 max-w-[11ch] font-serif text-7xl leading-[0.92] font-bold text-pretty max-lg:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted-strong)]">
              {t("hero.lede")}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <MetricCard icon={Users} label={t("stats.playersOnline")} tone="mint" value="1,284" />
              <MetricCard icon={Clock3} label={t("stats.openRooms")} tone="brass" value="42" />
            </div>
          </div>

          <BoardShowpiece label={t("board.label")} className="min-h-[520px]" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.78fr)_minmax(360px,0.42fr)]">
        <div className="grid gap-5 lg:grid-cols-2">
          <ActionCard
            body={t("cards.ai.body")}
            cta={t("cards.ai.cta")}
            href="/game"
            icon={Bot}
            title={t("cards.ai.title")}
            tone="mint"
          />
          <ActionCard
            body={t("cards.human.body")}
            cta={t("cards.human.cta")}
            href="/human"
            icon={Swords}
            title={t("cards.human.title")}
            tone="red"
          />
        </div>

        <Surface eyebrow={t("snapshot.eyebrow")} icon={Trophy} title={t("snapshot.title")}>
          <div className="grid gap-2">
            {snapshot.map(([rank, player, rating, delta]) => (
              <Link
                key={player}
                href={`/profile/${player}`}
                className="grid min-h-14 grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3 text-inherit no-underline hover:bg-white/[0.06]"
              >
                <span className="font-serif text-2xl font-bold text-[var(--brass)] tabular-nums">
                  {rank}
                </span>
                <span className="min-w-0 truncate font-black">{player}</span>
                <span className="font-black text-[var(--brass)] tabular-nums">{rating}</span>
                <span
                  className={
                    delta.startsWith("+")
                      ? "font-black text-[var(--mint)]"
                      : "font-black text-[var(--danger)]"
                  }
                >
                  {delta}
                </span>
              </Link>
            ))}
          </div>
        </Surface>
      </section>

      <Surface eyebrow={t("activity.eyebrow")} icon={Activity} title={t("activity.title")}>
        <div className="grid gap-2 lg:grid-cols-2">
          {activity.map((item) => (
            <article
              key={`${item.name}-${item.time}`}
              className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3"
            >
              <span className="grid size-10 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.08] font-black">
                {item.name.charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-black">{item.name}</span>
                <span className="block truncate text-sm text-[var(--muted-text)]">
                  {item.event}
                </span>
              </span>
              <span className="text-xs font-black text-[var(--brass)]">{item.time}</span>
            </article>
          ))}
        </div>
      </Surface>
    </PageShell>
  );
}
