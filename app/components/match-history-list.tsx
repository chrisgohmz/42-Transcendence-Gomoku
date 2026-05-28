"use client";

import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo } from "react";
import type { ReactNode } from "react";

import { Badge, Surface } from "@/components/gomoku-ui";
import type { ProfileRecentMatch } from "@/lib/stats/profile-stats";

type MatchHistoryListProps = {
  matches: ProfileRecentMatch[];
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  queryString?: string;
  onFiltersChange?: (updates: Record<string, string | null>) => void;
  onPageChange: (page: number) => void;
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

export default function MatchHistoryList({
  matches,
  isLoading,
  error,
  page,
  totalPages,
  queryString = "",
  onFiltersChange,
  onPageChange,
}: MatchHistoryListProps) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const shouldShowPagination = totalPages > 1;
  const opponentId = useId();
  const dateFromId = useId();
  const dateToId = useId();
  const activeQuery = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const canFilter = typeof onFiltersChange === "function";
  const hasFilters = Boolean(
    activeQuery.get("opponent") ||
    activeQuery.get("result") ||
    activeQuery.get("matchType") ||
    activeQuery.get("dateFrom") ||
    activeQuery.get("dateTo") ||
    activeQuery.get("sort"),
  );

  return (
    <Surface eyebrow={t("page.recentMatches.eyebrow")} title={t("page.recentMatches.title")}>
      {canFilter ? (
        <form
          key={queryString}
          className="grid gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const result = formValue(form, "result", "all");
            const matchType = formValue(form, "matchType", "all");
            const sort = formValue(form, "sort", "newest");

            onFiltersChange({
              opponent: formValue(form, "opponent").trim() || null,
              result: result === "all" ? null : result,
              matchType: matchType === "all" ? null : matchType,
              dateFrom: formValue(form, "dateFrom").trim() || null,
              dateTo: formValue(form, "dateTo").trim() || null,
              sort: sort === "newest" ? null : sort,
            });
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
            <label className="grid gap-1.5 text-xs font-black tracking-[0.08em] text-[var(--muted-text)] uppercase">
              <span>{t("page.recentMatches.search.opponent")}</span>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-text)]"
                />
                <input
                  id={opponentId}
                  name="opponent"
                  defaultValue={activeQuery.get("opponent") ?? ""}
                  aria-label={t("page.recentMatches.search.opponent")}
                  placeholder={t("page.recentMatches.search.opponentPlaceholder")}
                  className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 pr-3 pl-9 text-sm font-bold outline-none focus:border-[var(--mint)]"
                />
              </div>
            </label>

            <SelectField
              label={t("page.recentMatches.search.result")}
              name="result"
              value={activeQuery.get("result") ?? "all"}
            >
              <option value="all">{t("page.recentMatches.search.allResults")}</option>
              <option value="WIN">{t("page.recentMatches.results.won")}</option>
              <option value="LOSS">{t("page.recentMatches.results.lost")}</option>
              <option value="DRAW">{t("page.recentMatches.results.draw")}</option>
              <option value="CANCELLED">{t("page.recentMatches.results.cancelled")}</option>
            </SelectField>

            <SelectField
              label={t("page.recentMatches.search.matchType")}
              name="matchType"
              value={activeQuery.get("matchType") ?? "all"}
            >
              <option value="all">{t("page.recentMatches.search.allTypes")}</option>
              <option value="gomoku">{t("page.recentMatches.search.gomoku")}</option>
              <option value="renju">{t("page.recentMatches.search.renju")}</option>
            </SelectField>

            <InputField
              id={dateFromId}
              label={t("page.recentMatches.search.from")}
              name="dateFrom"
              type="date"
              value={activeQuery.get("dateFrom") ?? ""}
            />
            <InputField
              id={dateToId}
              label={t("page.recentMatches.search.to")}
              name="dateTo"
              type="date"
              value={activeQuery.get("dateTo") ?? ""}
            />

            <SelectField
              label={t("page.recentMatches.search.sort")}
              name="sort"
              value={activeQuery.get("sort") ?? "newest"}
            >
              <option value="newest">{t("page.recentMatches.search.sortOptions.newest")}</option>
              <option value="oldest">{t("page.recentMatches.search.sortOptions.oldest")}</option>
              <option value="moves_desc">
                {t("page.recentMatches.search.sortOptions.movesDesc")}
              </option>
              <option value="moves_asc">
                {t("page.recentMatches.search.sortOptions.movesAsc")}
              </option>
            </SelectField>

            <div className="flex gap-2 md:col-span-2 xl:col-span-3">
              <button type="submit" className="btn m-0 h-10 px-3">
                <SlidersHorizontal aria-hidden="true" className="size-4" />
                {t("page.recentMatches.search.apply")}
              </button>
              {hasFilters ? (
                <button
                  type="button"
                  className="btn btn-subtle m-0 h-10 px-3"
                  onClick={() =>
                    onFiltersChange({
                      opponent: null,
                      result: null,
                      matchType: null,
                      dateFrom: null,
                      dateTo: null,
                      sort: null,
                    })
                  }
                >
                  <X aria-hidden="true" className="size-4" />
                  {t("page.recentMatches.search.clear")}
                </button>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}

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

      {shouldShowPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-border-soft)] pt-4 text-sm">
          <span className="font-bold text-[var(--muted-text)]">
            {t("page.recentMatches.pagination", { page, totalPages })}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              className="btn btn-subtle m-0 h-9 px-3 text-xs disabled:opacity-50"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              {t("page.recentMatches.previous")}
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="btn btn-subtle m-0 h-9 px-3 text-xs disabled:opacity-50"
            >
              {t("page.recentMatches.next")}
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </Surface>
  );
}

function formValue(form: FormData, key: string, fallback = ""): string {
  const value = form.get(key);
  return typeof value === "string" ? value : fallback;
}

function SelectField({
  children,
  label,
  name,
  value,
}: {
  children: ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-black tracking-[0.08em] text-[var(--muted-text)] uppercase">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 px-3 text-sm font-bold outline-none focus:border-[var(--mint)]"
      >
        {children}
      </select>
    </label>
  );
}

function InputField({
  id,
  label,
  name,
  type,
  value,
}: {
  id: string;
  label: string;
  name: string;
  type: string;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-black tracking-[0.08em] text-[var(--muted-text)] uppercase">
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={value}
        aria-label={label}
        className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 px-3 text-sm font-bold outline-none focus:border-[var(--mint)]"
      />
    </label>
  );
}
