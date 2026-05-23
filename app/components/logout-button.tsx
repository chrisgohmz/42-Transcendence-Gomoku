"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { signOutCurrentSession } from "@/lib/auth-client";

export const LogoutButton = () => {
  const router = useRouter();
  const t = useTranslations("logout");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setPending(true);
    setError(null);

    try {
      await signOutCurrentSession();
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
