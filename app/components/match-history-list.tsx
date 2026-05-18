"use client";

import { useLocale, useTranslations } from "next-intl";

import { Badge, Surface } from "@/components/gomoku-ui";
import type { ProfileRecentMatch } from "@/lib/stats/profile-stats";

type MatchHistoryListProps = {
  matches: ProfileRecentMatch[];
  isLoading: boolean;
  error: string | null;
};

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

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

function formatEndReason(reason: string | null, t: Translate) {
  switch (reason) {
    case "five_in_a_row":
      return t("page.recentMatches.endReasons.fiveInARow");
    case "draw":
      return t("page.recentMatches.endReasons.draw");
    case "resign":
      return t("page.recentMatches.endReasons.resign");
    case "queue_cancelled":
      return t("page.recentMatches.endReasons.queueCancelled");
    case "queue_expired":
      return t("page.recentMatches.endReasons.queueExpired");
    case "abandoned":
      return t("page.recentMatches.endReasons.abandoned");
    default:
      return t("page.recentMatches.endReasons.unknown");
  }
}

export default function MatchHistoryList({ matches, isLoading, error }: MatchHistoryListProps) {
  const t = useTranslations("profile");
  const locale = useLocale();

  return (
    <Surface eyebrow={t("page.recentMatches.eyebrow")} title={t("page.recentMatches.title")}>
      <div className="overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[minmax(160px,1fr)_90px_80px_minmax(140px,1fr)_120px] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
            <span>{t("page.recentMatches.headers.opponent")}</span>
            <span>{t("page.recentMatches.headers.result")}</span>
            <span>{t("page.recentMatches.headers.moves")}</span>
            <span>{t("page.recentMatches.headers.endReason")}</span>
            <span>{t("page.recentMatches.headers.date")}</span>
          </div>

          {isLoading ? (
            <div className="border-b border-[var(--panel-border-soft)] px-4 py-6 text-sm font-bold text-[var(--muted-text)]">
              {t("page.recentMatches.loading")}
            </div>
          ) : error ? (
            <div className="border-b border-[var(--panel-border-soft)] px-4 py-6 text-sm font-bold text-[var(--danger)]">
              {error}
            </div>
          ) : matches.length > 0 ? (
            matches.map((match) => {
              const opponentName =
                match.opponentDisplayName || t("page.recentMatches.unknownOpponent");
              const isWin = match.result === "WIN";
              const isLoss = match.result === "LOSS";
              const isDraw = match.result === "DRAW";
              const resultTone = isWin ? "mint" : isLoss ? "red" : "neutral";
              const resultText = isWin
                ? t("page.recentMatches.results.won")
                : isLoss
                  ? t("page.recentMatches.results.lost")
                  : isDraw
                    ? t("page.recentMatches.results.draw")
                    : t("page.recentMatches.results.cancelled");
              const endReason = formatEndReason(match.endReason, t);
              const dateText = formatDate(
                match.finishedAt,
                locale,
                t("page.recentMatches.unknownDate"),
              );

              return (
                <article
                  key={match.matchId}
                  className="grid grid-cols-[minmax(160px,1fr)_90px_80px_minmax(140px,1fr)_120px] items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 last:border-b-0 hover:bg-white/[0.05]"
                >
                  <span className="truncate font-black">{opponentName}</span>
                  <Badge tone={resultTone}>{resultText}</Badge>
                  <span className="font-black text-[var(--muted-strong)] tabular-nums">
                    {match.moveCount}
                  </span>
                  <span className="truncate text-sm text-[var(--muted-text)]">{endReason}</span>
                  <span className="text-sm text-[var(--muted-text)]">{dateText}</span>
                </article>
              );
            })
          ) : (
            <div className="border-b border-[var(--panel-border-soft)] px-4 py-6 text-sm font-bold text-[var(--muted-text)]">
              {t("page.recentMatches.empty")}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}
