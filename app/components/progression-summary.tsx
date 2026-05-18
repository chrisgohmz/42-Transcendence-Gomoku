"use client";

import { Award, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge, MetricCard, Surface } from "@/components/gomoku-ui";
import type { ProfileStatsSnapshot } from "@/lib/stats/profile-stats";

type ProgressionSummaryProps = {
  stats: ProfileStatsSnapshot["stats"] | null;
  progression: ProfileStatsSnapshot["progression"] | null;
  achievements: ProfileStatsSnapshot["achievements"];
  rank: number | null;
  isLoading: boolean;
};

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

type Achievement = ProfileStatsSnapshot["achievements"][number];

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function humanizeAchievementCode(code: string) {
  return code
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();
}

function formatAchievementLabel(code: string, t: Translate) {
  const map: Record<string, string> = {
    first_win: t("page.achievements.items.first_win"),
    first_friend: t("page.achievements.items.first_friend"),
    ten_moves: t("page.achievements.items.ten_moves"),
    ai_win: t("page.achievements.items.ai_win"),
    win_streak_3: t("page.achievements.items.win_streak_3"),
  };

  return map[code] ?? humanizeAchievementCode(code);
}

function sortAchievements(entries: Achievement[]) {
  return [...entries]
    .filter((entry) => entry.completedAt)
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });
}

export default function ProgressionSummary({
  stats,
  progression,
  achievements,
  rank,
  isLoading,
}: ProgressionSummaryProps) {
  const t = useTranslations("profile");
  const locale = useLocale();

  const rankText = isLoading ? "..." : rank ? `#${rank}` : t("page.about.unranked");
  const levelValue = progression?.level ?? 1;
  const levelText = isLoading ? "..." : t("page.about.levelValue", { level: levelValue });
  const currentStreak = isLoading ? "..." : (stats?.currentStreak ?? 0);
  const bestStreak = isLoading ? "..." : (stats?.bestStreak ?? 0);
  const lastPlayedText = isLoading
    ? "..."
    : formatDate(stats?.lastPlayedAt ?? null, locale, t("page.about.noActivity"));

  const unlocked = sortAchievements(achievements);
  const visibleAchievements = unlocked.slice(0, 3);
  const extraCount = Math.max(0, unlocked.length - visibleAchievements.length);
  const achievementPoints = progression?.achievementPoints ?? 0;

  const progressPercent = Math.round((progression?.progress ?? 0) * 100);
  const progressRange = t("page.progress.range", {
    from: t("page.progress.level", { level: levelValue }),
    to: t("page.progress.level", { level: levelValue + 1 }),
  });

  return (
    <aside className="grid content-start gap-5">
      <Surface eyebrow={t("page.about.eyebrow")} icon={UserRound} title={t("page.about.title")}>
        <p className="m-0 leading-7 text-[var(--muted-text)]">{t("page.about.body")}</p>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label={t("page.about.rankLabel")} tone="brass" value={rankText} />
          <MetricCard label={t("page.about.levelLabel")} tone="mint" value={levelText} />
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between text-[var(--muted-text)]">
            <span>{t("page.about.currentStreakLabel")}</span>
            <span className="font-black text-[var(--text)] tabular-nums">{currentStreak}</span>
          </div>
          <div className="flex items-center justify-between text-[var(--muted-text)]">
            <span>{t("page.about.bestStreakLabel")}</span>
            <span className="font-black text-[var(--text)] tabular-nums">{bestStreak}</span>
          </div>
          <div className="flex items-center justify-between text-[var(--muted-text)]">
            <span>{t("page.about.lastPlayedLabel")}</span>
            <span className="font-black text-[var(--text)]">{lastPlayedText}</span>
          </div>
        </div>
      </Surface>

      <Surface
        eyebrow={t("page.achievements.eyebrow")}
        icon={Award}
        title={t("page.achievements.title")}
      >
        {isLoading ? (
          <p className="m-0 text-sm text-[var(--muted-text)]">{t("page.achievements.loading")}</p>
        ) : visibleAchievements.length > 0 ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {visibleAchievements.map((entry) => (
                <Badge key={entry.code} tone="brass">
                  <Award aria-hidden="true" className="size-3.5" />
                  {formatAchievementLabel(entry.code, t)}
                </Badge>
              ))}
              {extraCount > 0 ? (
                <Badge tone="neutral">{t("page.achievements.more", { count: extraCount })}</Badge>
              ) : null}
            </div>
            <p className="m-0 text-xs font-bold text-[var(--muted-text)]">
              {t("page.achievements.summary", { count: unlocked.length })}
              {progression
                ? ` · ${t("page.achievements.points", { points: achievementPoints })}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--muted-text)]">{t("page.achievements.empty")}</p>
        )}
      </Surface>

      <Surface eyebrow={t("page.progress.eyebrow")} title={t("page.progress.title")}>
        {isLoading ? (
          <p className="m-0 text-sm text-[var(--muted-text)]">{t("page.progress.loading")}</p>
        ) : progression ? (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm font-bold">
              <span>{progressRange}</span>
              <span className="text-[var(--mint)]">{progressPercent}%</span>
            </div>
            <span className="block h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className="block h-full rounded-full bg-[linear-gradient(90deg,var(--mint),var(--brass))]"
                style={{ width: `${progressPercent}%` }}
              />
            </span>
            <div className="mt-3 flex items-center justify-between text-xs font-bold text-[var(--muted-text)]">
              <span>
                {t("page.progress.xp", {
                  current: progression.currentXp,
                  next: progression.nextLevelXp,
                })}
              </span>
              <span>{t("page.progress.achievementPoints", { points: achievementPoints })}</span>
            </div>
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--muted-text)]">{t("page.progress.unavailable")}</p>
        )}
      </Surface>
    </aside>
  );
}
