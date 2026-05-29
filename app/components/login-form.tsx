"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { FieldErrorList } from "@/components/field-error-list";
import { OAuthProviderButtons } from "@/components/oauth-provider-buttons";
import { Link } from "@/i18n/navigation";
import type { OAuthProviderId } from "@/lib/oauth-providers";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

import { initialLoginActionState } from "../auth-action-state";
import { loginAction } from "../auth-actions";

type LoginFormProps = {
  oauthErrorMessage?: string | null;
  oauthProviders: OAuthProviderId[];
};

export function LoginForm({ oauthErrorMessage = null, oauthProviders }: LoginFormProps) {
  const locale = useLocale();
  const shared = useTranslations("auth.shared");
  const login = useTranslations("auth.login");
  const [state, formAction, pending] = useActionState(loginAction, initialLoginActionState);
  const emailErrorId = "login-email-errors";
  const passwordErrorId = "login-password-errors";

  return (
    <form className="grid gap-5" action={formAction}>
      <input type="hidden" name="locale" value={locale} />

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
            aria-label={shared("email")}
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
            autoComplete="current-password"
            className="text-input field-input"
            required
            minLength={authValidationLimits.passwordMinLength}
            maxLength={authValidationLimits.passwordMaxLength}
            aria-label={shared("password")}
            aria-describedby={state.fields.password ? passwordErrorId : undefined}
            aria-invalid={Boolean(state.fields.password)}
          />
        </div>
        <p className="helper">{shared("passwordHelper")}</p>
        <FieldErrorList id={passwordErrorId} errors={state.fields.password} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2 font-bold text-[var(--muted-text)]">
          <input
            type="checkbox"
            name="remember"
            aria-label={login("rememberThisTable")}
            className="size-4 rounded border border-[var(--panel-border-soft)] bg-[var(--panel-solid)]"
          />
          {login("rememberThisTable")}
        </label>
        <Link href="/forgot-password" className="text-link">
          {login("forgotPassword")}
        </Link>
      </div>

      {state.message ? (
        <p className="error-text" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <button className="btn m-0 w-full" type="submit" disabled={pending}>
        {pending ? login("submitting") : login("submit")}
      </button>

      <OAuthProviderButtons
        callbackPath={`/${locale}/profile`}
        errorPath={`/${locale}/login`}
        initialErrorMessage={oauthErrorMessage}
        providers={oauthProviders}
      />

      <div className="inline-links">
        <span className="helper">{login("newHere")}</span>
        <Link href="/signup" className="text-link">
          {login("signupLink")}
        </Link>
      </div>
    </form>
  );
}
