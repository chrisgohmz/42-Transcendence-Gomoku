"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";

import { initialSignupActionState } from "../auth-action-state";
import { signupAction } from "../auth-actions";

export function SignupForm() {
  const locale = useLocale();
  const shared = useTranslations("auth.shared");
  const signup = useTranslations("auth.signup");
  const [state, formAction, pending] = useActionState(signupAction, initialSignupActionState);

  return (
    <form className="form-grid" action={formAction}>
      <input type="hidden" name="locale" value={locale} />

      <div className="field">
        <label className="field-label" htmlFor="username">
          {signup("username")}
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
        <p className="helper">{signup("usernameHelper")}</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="displayName">
          {signup("displayName")}
        </label>
        <input
          id="displayName"
          name="displayName"
          className="text-input"
          defaultValue={state.displayName}
          placeholder={signup("displayNamePlaceholder")}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="email">
          {shared("email")}
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
          {shared("password")}
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
        <p className="helper">{shared("passwordHelper")}</p>
      </div>

      {state.message ? (
        <p className="error-text" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="btn" type="submit" disabled={pending}>
        {pending ? signup("submitting") : signup("submit")}
      </button>

      <div className="inline-links">
        <span className="helper">{signup("alreadyHaveAccount")}</span>
        <Link href="/login" className="text-link">
          {signup("signInLink")}
        </Link>
      </div>
    </form>
  );
}
