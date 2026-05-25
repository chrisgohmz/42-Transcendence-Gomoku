"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProfileStatsSnapshot } from "@/lib/stats/profile-stats";

type ErrorResponse = {
  message?: string;
};

function getErrorMessage(payload: ErrorResponse | null) {
  return payload?.message ?? null;
}

export function useProfileStats(queryString = "") {
  const t = useTranslations("profile");
  const [data, setData] = useState<ProfileStatsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (pageToLoad = 1, queryString = "") => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(queryString);
        params.set("page", String(pageToLoad));
        params.set("limit", "10");
        const response = await fetch(`/api/profile/stats?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (requestId !== requestIdRef.current) return;

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
        if (requestId !== requestIdRef.current) return;
        setData(payload);
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        if (requestId !== requestIdRef.current) return;
        console.error("Error loading profile stats:", caught);
        setData(null);
        setError(t("page.errors.network"));
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      }
    },
    [t],
  );

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const page = Number(params.get("page") ?? "1");
    void load(Number.isInteger(page) && page > 0 ? page : 1, queryString);
  }, [load, queryString]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    refresh: load,
  };
}
