"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { FieldErrorList } from "@/components/field-error-list";
import { Link } from "@/i18n/navigation";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

import { initialLoginActionState } from "../auth-action-state";
import { loginAction } from "../auth-actions";

export function LoginForm() {
  const locale = useLocale();
  const shared = useTranslations("auth.shared");
  const login = useTranslations("auth.login");
  const [state, formAction, pending] = useActionState(loginAction, initialLoginActionState);
  const emailErrorId = "login-email-errors";
  const passwordErrorId = "login-password-errors";

  return (
    <form className="form-grid" action={formAction}>
      <input type="hidden" name="locale" value={locale} />

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
          maxLength={authValidationLimits.emailMaxLength}
          aria-describedby={state.fields.email ? emailErrorId : undefined}
          aria-invalid={Boolean(state.fields.email)}
          required
        />
        <FieldErrorList id={emailErrorId} errors={state.fields.email} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="password">
          {shared("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="text-input"
          required
          minLength={authValidationLimits.passwordMinLength}
          maxLength={authValidationLimits.passwordMaxLength}
          aria-describedby={state.fields.password ? passwordErrorId : undefined}
          aria-invalid={Boolean(state.fields.password)}
        />
        <p className="helper">{shared("passwordHelper")}</p>
        <FieldErrorList id={passwordErrorId} errors={state.fields.password} />
      </div>

      {state.message ? (
        <p className="error-text" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="btn" type="submit" disabled={pending}>
        {pending ? login("submitting") : login("submit")}
      </button>

      <div className="inline-links">
        <span className="helper">{login("newHere")}</span>
        <Link href="/signup" className="text-link">
          {login("signupLink")}
        </Link>
      </div>
    </form>
  );
}
