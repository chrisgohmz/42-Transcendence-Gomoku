"use client";

import { ChevronLeft, ChevronRight, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo } from "react";
import type { ReactNode } from "react";

import LeaderboardTable from "@/components/leaderboardtable";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import type { LeaderboardSearchQuery } from "@/lib/advanced-search";
import type { LeaderboardScope, LeaderboardSnapshot } from "@/lib/leaderboard";

export default function LeaderboardClient({
  initial,
  query,
  queryString,
  scope = "all",
}: {
  initial?: LeaderboardSnapshot | null;
  query: LeaderboardSearchQuery;
  queryString: string;
  scope?: LeaderboardScope;
}) {
  const t = useTranslations("leaderboard");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { entries, currentUser, loading, error, refresh } = useLeaderboard(
    initial ?? null,
    scope,
    queryString,
  );
  const pagination = initial?.pagination ?? {
    page: query.page,
    limit: query.limit,
    totalEntries: entries.length,
    totalPages: 1,
  };
  const hasFilters = useMemo(
    () =>
      Boolean(
        query.q ||
        query.band !== "all" ||
        query.minRating !== null ||
        query.maxRating !== null ||
        query.minMatches !== null ||
        query.sort !== "rank",
      ),
    [query],
  );

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    });

    if (!("page" in updates)) {
      next.delete("page");
    }

    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams.toString());
    ["q", "band", "minRating", "maxRating", "minMatches", "sort", "page"].forEach((key) =>
      next.delete(key),
    );
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <>
      <LeaderboardControls
        formKey={queryString}
        hasFilters={hasFilters}
        query={query}
        onClear={clearFilters}
        onUpdate={updateQuery}
      />
      <LeaderboardTable entries={entries} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025] px-4 py-3 text-sm">
        <span className="font-bold text-[var(--muted-text)]">
          {t("page.pagination", {
            page: pagination.page,
            players: pagination.totalEntries,
            totalPages: pagination.totalPages,
          })}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-subtle m-0 h-9 px-3 text-xs disabled:opacity-50"
            disabled={pagination.page <= 1 || loading}
            onClick={() => updateQuery({ page: String(pagination.page - 1) })}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {t("page.previous")}
          </button>
          <button
            type="button"
            className="btn btn-subtle m-0 h-9 px-3 text-xs disabled:opacity-50"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => updateQuery({ page: String(pagination.page + 1) })}
          >
            {t("page.next")}
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <div className="rounded-md border border-[var(--brass)]/35 bg-[linear-gradient(90deg,rgba(216,172,89,0.16),rgba(255,255,255,0.03))] p-4">
        <div className="flex items-start justify-between">
          <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)_repeat(3,110px)] md:items-center">
            <div>
              <p className="m-0 text-xs font-black tracking-[0.16em] text-[var(--muted-text)] uppercase">
                {t("page.spotlight.rankLabel")}
              </p>
              <p className="m-0 font-serif text-4xl font-black text-[var(--brass)]">
                {currentUser?.rank ?? "—"}
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full border border-[var(--brass)]/45 bg-white/[0.08] font-black">
                {currentUser ? currentUser.player.charAt(0) : "?"}
              </span>
              <div>
                <p className="m-0 text-xl font-black">
                  {currentUser?.player ?? t("page.spotlight.noPlayer")}
                </p>
                <p className="m-0 text-sm text-[var(--brass)]">
                  {t("page.spotlight.rating", {
                    rating: currentUser ? currentUser.rating.toLocaleString() : "—",
                  })}
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{t("table.wins")}</p>
              <p className="m-0 font-black tabular-nums">{currentUser?.wins ?? "—"}</p>
            </div>
            <div className="hidden md:block">
              <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{t("table.losses")}</p>
              <p className="m-0 font-black tabular-nums">{currentUser?.losses ?? "—"}</p>
            </div>
            <div className="hidden md:block">
              <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{t("table.winRate")}</p>
              <p className="m-0 font-black tabular-nums">{currentUser?.winRate ?? "—"}</p>
            </div>
          </div>

          <div className="ml-4 flex items-start gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold"
              onClick={() => refresh()}
              disabled={loading}
            >
              <RefreshCw className="size-4" />
              {loading ? t("page.refreshing") : t("page.refresh")}
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </div>
    </>
  );
}

function LeaderboardControls({
  formKey,
  hasFilters,
  query,
  onClear,
  onUpdate,
}: {
  formKey: string;
  hasFilters: boolean;
  query: LeaderboardSearchQuery;
  onClear: () => void;
  onUpdate: (updates: Record<string, string | null>) => void;
}) {
  const t = useTranslations("leaderboard");
  const searchId = useId();
  const minRatingId = useId();
  const maxRatingId = useId();
  const minMatchesId = useId();

  return (
    <form
      key={formKey}
      className="grid gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const band = formValue(form, "band", "all");
        const sort = formValue(form, "sort", "rank");
        onUpdate({
          q: formValue(form, "q").trim() || null,
          band: band === "all" ? null : band,
          minRating: formValue(form, "minRating").trim() || null,
          maxRating: formValue(form, "maxRating").trim() || null,
          minMatches: formValue(form, "minMatches").trim() || null,
          sort: sort === "rank" ? null : sort,
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
        <Field label={t("page.search.player")}>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-text)]"
            />
            <input
              id={searchId}
              name="q"
              defaultValue={query.q}
              placeholder={t("page.search.playerPlaceholder")}
              className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 pr-3 pl-9 text-sm font-bold outline-none focus:border-[var(--mint)]"
            />
          </div>
        </Field>

        <Field label={t("page.search.band")}>
          <select
            name="band"
            defaultValue={query.band}
            className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 px-3 text-sm font-bold outline-none focus:border-[var(--mint)]"
          >
            <option value="all">{t("page.search.allBands")}</option>
            <option value="dan">{t("page.distribution.labels.dan")}</option>
            <option value="kyu">{t("page.distribution.labels.kyu")}</option>
            <option value="unranked">{t("page.distribution.labels.unranked")}</option>
          </select>
        </Field>

        <Field label={t("page.search.minRating")}>
          <input
            id={minRatingId}
            name="minRating"
            type="number"
            defaultValue={query.minRating ?? ""}
            className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 px-3 text-sm font-bold outline-none focus:border-[var(--mint)]"
          />
        </Field>

        <Field label={t("page.search.maxRating")}>
          <input
            id={maxRatingId}
            name="maxRating"
            type="number"
            defaultValue={query.maxRating ?? ""}
            className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 px-3 text-sm font-bold outline-none focus:border-[var(--mint)]"
          />
        </Field>

        <Field label={t("page.search.minMatches")}>
          <input
            id={minMatchesId}
            name="minMatches"
            type="number"
            min="0"
            defaultValue={query.minMatches ?? ""}
            className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 px-3 text-sm font-bold outline-none focus:border-[var(--mint)]"
          />
        </Field>

        <Field label={t("page.search.sort")}>
          <select
            name="sort"
            defaultValue={query.sort}
            className="h-10 w-full rounded-md border border-[var(--panel-border-soft)] bg-black/20 px-3 text-sm font-bold outline-none focus:border-[var(--mint)]"
          >
            <option value="rank">{t("page.search.sortOptions.rank")}</option>
            <option value="rating_asc">{t("page.search.sortOptions.ratingAsc")}</option>
            <option value="wins_desc">{t("page.search.sortOptions.winsDesc")}</option>
            <option value="matches_desc">{t("page.search.sortOptions.matchesDesc")}</option>
          </select>
        </Field>

        <div className="flex gap-2 md:col-span-2 xl:col-span-3">
          <button type="submit" className="btn m-0 h-10 px-3">
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            {t("page.search.apply")}
          </button>
          {hasFilters ? (
            <button type="button" className="btn btn-subtle m-0 h-10 px-3" onClick={onClear}>
              <X aria-hidden="true" className="size-4" />
              {t("page.search.clear")}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function formValue(form: FormData, key: string, fallback = ""): string {
  const value = form.get(key);
  return typeof value === "string" ? value : fallback;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-black tracking-[0.08em] text-[var(--muted-text)] uppercase">
      <span>{label}</span>
      {children}
    </label>
  );
}
