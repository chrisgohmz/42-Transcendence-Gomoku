"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import MatchHistoryList from "@/components/match-history-list";
import type { ProfileRecentMatch } from "@/lib/stats/profile-stats";

type PublicMatchHistoryProps = {
  matches: ProfileRecentMatch[];
  page: number;
  totalPages: number;
};

export default function PublicMatchHistory({ matches, page, totalPages }: PublicMatchHistoryProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <MatchHistoryList
      matches={matches}
      isLoading={false}
      error={null}
      page={page}
      totalPages={totalPages}
      onPageChange={(nextPage) => {
        const params = new URLSearchParams(searchParams.toString());

        if (nextPage <= 1) {
          params.delete("historyPage");
        } else {
          params.set("historyPage", String(nextPage));
        }

        const queryString = params.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
          scroll: false,
        });
      }}
    />
  );
}
