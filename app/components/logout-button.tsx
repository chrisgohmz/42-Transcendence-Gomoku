"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

type LogoutError = {
  message?: string;
  error?: string;
  detail?: string;
};

export const LogoutButton = () => {
  const router = useRouter();
  const t = useTranslations("logout");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as LogoutError | null;
        const message = payload?.message ?? payload?.detail ?? t("unavailable");
        setError(message);
        return;
      }

      router.push("/login");
      router.refresh();
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : t("unexpected");
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="form-grid">
      <button type="button" className="btn btn-off" onClick={handleLogout} disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </button>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
