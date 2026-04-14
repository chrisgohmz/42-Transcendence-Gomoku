"use client";

import Link from "next/link";
import { useActionState } from "react";

import { initialSignupActionState } from "../auth-action-state";
import { signupAction } from "../auth-actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(
    signupAction,
    initialSignupActionState,
  );

  return (
    <form className="form-grid" action={formAction}>
      <div className="field">
        <label className="field-label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          className="text-input"
          autoComplete="username"
          defaultValue={state.username}
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
          defaultValue={state.displayName}
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
          autoComplete="new-password"
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
        {pending ? "Creating account..." : "Create account"}
      </button>

      <div className="inline-links">
        <span className="helper">Already have an account?</span>
        <Link href="/login" className="text-link">
          Sign in
        </Link>
      </div>
    </form>
  );
}
