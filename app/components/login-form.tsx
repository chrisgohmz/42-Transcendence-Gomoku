"use client";

import Link from "next/link";
import { useActionState } from "react";

import { initialLoginActionState } from "../auth-action-state";
import { loginAction } from "../auth-actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginActionState);

  return (
    <form className="form-grid" action={formAction}>
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
          defaultValue={state.email}
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
          required
          minLength={8}
        />
        <p className="helper">At least 8 characters.</p>
      </div>

      {state.message ? (
        <p className="error-text" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <div className="inline-links">
        <span className="helper">New here?</span>
        <Link href="/signup" className="text-link">
          Create an account
        </Link>
      </div>
    </form>
  );
}
