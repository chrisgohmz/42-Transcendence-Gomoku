"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { ProfileStatsSnapshot } from "@/lib/stats/profile-stats";

type ErrorResponse = {
  message?: string;
};

function getErrorMessage(payload: ErrorResponse | null) {
  return payload?.message ?? null;
}

export function useProfileStats() {
  const t = useTranslations("profile");
  const [data, setData] = useState<ProfileStatsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/stats", { cache: "no-store" });

      if (!response.ok) {
        if (response.status === 401) {
          setData(null);
          setError(t("page.errors.unauthorized"));
          return;
        }

        const payload = (await response.json().catch(() => null)) as ErrorResponse | null;
        const fallback = t("page.errors.requestFailed", { status: response.status });
        setData(null);
        setError(getErrorMessage(payload) ?? fallback);
        return;
      }

      const payload = (await response.json()) as ProfileStatsSnapshot;
      setData(payload);
      setError(null);
    } catch (caught) {
      console.error("Error loading profile stats:", caught);
      setData(null);
      setError(t("page.errors.network"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    error,
    isLoading,
    refresh: load,
  };
}
