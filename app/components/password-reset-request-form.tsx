"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { initialPasswordResetRequestActionState } from "@/auth-action-state";
import { requestPasswordResetAction } from "@/auth-actions";
import { FieldErrorList } from "@/components/field-error-list";
import { Link } from "@/i18n/navigation";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

export function PasswordResetRequestForm() {
  const locale = useLocale();
  const shared = useTranslations("auth.shared");
  const reset = useTranslations("auth.passwordReset");
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialPasswordResetRequestActionState,
  );
  const emailErrorId = "password-reset-email-errors";

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

      {state.successMessage ? (
        <p className="m-0 rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)] p-3 text-sm font-bold text-[var(--mint)]">
          {state.successMessage}
        </p>
      ) : null}

      {state.message ? (
        <p className="error-text" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <button className="btn m-0 w-full" type="submit" disabled={pending}>
        {pending ? reset("requestSubmitting") : reset("requestSubmit")}
      </button>

      <div className="inline-links">
        <Link href="/login" className="text-link">
          {reset("backToLogin")}
        </Link>
      </div>
    </form>
  );
}
