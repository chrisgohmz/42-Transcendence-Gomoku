"use client";

import { LockKeyhole, Mail, Signature, UserRound } from "lucide-react";
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
    <form className="grid gap-5" action={formAction}>
      <input type="hidden" name="locale" value={locale} />

      <div className="field">
        <label className="field-label" htmlFor="username">
          {signup("username")}
        </label>
        <div className="field-shell">
          <UserRound aria-hidden="true" className="size-4 text-[var(--brass)]" />
          <input
            id="username"
            name="username"
            className="text-input field-input"
            autoComplete="username"
            spellCheck={false}
            defaultValue={state.username}
            minLength={authValidationLimits.usernameMinLength}
            maxLength={authValidationLimits.usernameMaxLength}
            pattern="(?:[A-Za-z0-9_]|-)+"
            aria-describedby={state.fields.username ? usernameErrorId : undefined}
            aria-invalid={Boolean(state.fields.username)}
            required
          />
        </div>
        <p className="helper">{signup("usernameHelper")}</p>
        <FieldErrorList id={usernameErrorId} errors={state.fields.username} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="displayName">
          {signup("displayName")}
        </label>
        <div className="field-shell">
          <Signature aria-hidden="true" className="size-4 text-[var(--brass)]" />
          <input
            id="displayName"
            name="displayName"
            className="text-input field-input"
            defaultValue={state.displayName}
            maxLength={authValidationLimits.displayNameMaxLength}
            placeholder={signup("displayNamePlaceholder")}
            aria-describedby={state.fields.displayName ? displayNameErrorId : undefined}
            aria-invalid={Boolean(state.fields.displayName)}
          />
        </div>
        <FieldErrorList id={displayNameErrorId} errors={state.fields.displayName} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="email">
          {shared("email")}
        </label>
        <div className="field-shell">
          <Mail aria-hidden="true" className="size-4 text-[var(--brass)]" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            className="text-input field-input"
            defaultValue={state.email}
            maxLength={authValidationLimits.emailMaxLength}
            aria-describedby={state.fields.email ? emailErrorId : undefined}
            aria-invalid={Boolean(state.fields.email)}
            required
          />
        </div>
        <FieldErrorList id={emailErrorId} errors={state.fields.email} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="password">
          {shared("password")}
        </label>
        <div className="field-shell">
          <LockKeyhole aria-hidden="true" className="size-4 text-[var(--brass)]" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="text-input field-input"
            required
            minLength={authValidationLimits.passwordMinLength}
            maxLength={authValidationLimits.passwordMaxLength}
            aria-describedby={state.fields.password ? passwordErrorId : undefined}
            aria-invalid={Boolean(state.fields.password)}
          />
        </div>
        <p className="helper">{shared("passwordHelper")}</p>
        <FieldErrorList id={passwordErrorId} errors={state.fields.password} />
      </div>

      {state.message ? (
        <p className="error-text" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <button className="btn m-0 w-full" type="submit" disabled={pending}>
        {pending ? signup("submitting") : signup("submit")}
      </button>

      <p className="m-0 text-xs leading-5 text-[var(--muted-text)]">
        By creating an account, you agree to the{" "}
        <Link href="/terms" className="text-link">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-link">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="inline-links">
        <span className="helper">{signup("alreadyHaveAccount")}</span>
        <Link href="/login" className="text-link">
          {signup("signInLink")}
        </Link>
      </div>
    </form>
  );
}
