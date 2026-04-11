"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthError = {
  error?: string;
  message?: string;
  detail?: string;
};

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as AuthError | null;
        const message =
          payload?.message ??
          payload?.detail ??
          "Unable to sign in with those credentials.";
        setError(message);
        return;
      }

      router.push("/account");
      router.refresh();
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Unexpected error while signing in.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Authentication</p>
        <h1>Welcome back.</h1>
        <p className="lede">
          Sign in to create rooms, play matches, and access your private pages.
        </p>
      </section>

      <section className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="text-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="text-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
            <p className="helper">At least 8 characters.</p>
          </div>

          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}

          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>

          <div className="inline-links">
            <span className="helper">New here?</span>
            <Link href="/signup" className="text-link">
              Create an account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
