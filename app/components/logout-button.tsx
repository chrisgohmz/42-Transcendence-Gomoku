"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LogoutError = {
  message?: string;
  error?: string;
  detail?: string;
};

export const LogoutButton = () => {
  const router = useRouter();
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
        const payload = (await response
          .json()
          .catch(() => null)) as LogoutError | null;
        const message =
          payload?.message ??
          payload?.detail ??
          "Unable to end your session right now.";
        setError(message);
        return;
      }

      router.push("/login");
      router.refresh();
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Unexpected error while logging out.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="form-grid">
      <button
        type="button"
        className="btn btn-off"
        onClick={handleLogout}
        disabled={pending}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
