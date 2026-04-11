"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthError = {
  error?: string;
  message?: string;
  detail?: string;
};

const SignupPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          displayName,
          password,
        }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as AuthError | null;
        const message =
          payload?.message ??
          payload?.detail ??
          "Unable to create your account right now.";
        setError(message);
        return;
      }

      router.push("/account");
      router.refresh();
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Unexpected error while creating your account.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Authentication</p>
        <h1>Create your account.</h1>
        <p className="lede">
          Use an email and password to start playing immediately. No third-party
          provider setup required.
        </p>
      </section>

      <section className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              className="text-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              required
            />
            <p className="helper">Minimum 3 characters.</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              className="text-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How other players will see you"
            />
          </div>

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
              autoComplete="new-password"
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
            {pending ? "Creating account…" : "Create account"}
          </button>

          <div className="inline-links">
            <span className="helper">Already have an account?</span>
            <Link href="/login" className="text-link">
              Sign in
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
};

export default SignupPage;
