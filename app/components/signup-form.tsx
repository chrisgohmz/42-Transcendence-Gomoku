"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { FieldErrorList } from "@/components/field-error-list";
import { Link } from "@/i18n/navigation";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

import { initialSignupActionState } from "../auth-action-state";
import { signupAction } from "../auth-actions";

export function SignupForm() {
  const locale = useLocale();
  const shared = useTranslations("auth.shared");
  const signup = useTranslations("auth.signup");
  const [state, formAction, pending] = useActionState(signupAction, initialSignupActionState);
  const usernameErrorId = "signup-username-errors";
  const displayNameErrorId = "signup-displayName-errors";
  const emailErrorId = "signup-email-errors";
  const passwordErrorId = "signup-password-errors";

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
          minLength={authValidationLimits.usernameMinLength}
          maxLength={authValidationLimits.usernameMaxLength}
          pattern="(?:[A-Za-z0-9_]|-)+"
          aria-describedby={state.fields.username ? usernameErrorId : undefined}
          aria-invalid={Boolean(state.fields.username)}
          required
        />
        <p className="helper">{signup("usernameHelper")}</p>
        <FieldErrorList id={usernameErrorId} errors={state.fields.username} />
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
          maxLength={authValidationLimits.displayNameMaxLength}
          placeholder={signup("displayNamePlaceholder")}
          aria-describedby={state.fields.displayName ? displayNameErrorId : undefined}
          aria-invalid={Boolean(state.fields.displayName)}
        />
        <FieldErrorList id={displayNameErrorId} errors={state.fields.displayName} />
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
          autoComplete="new-password"
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
