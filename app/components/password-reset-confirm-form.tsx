"use client";

import { LockKeyhole } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { initialPasswordResetConfirmActionState } from "@/auth-action-state";
import { resetPasswordAction } from "@/auth-actions";
import { FieldErrorList } from "@/components/field-error-list";
import { Link } from "@/i18n/navigation";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const locale = useLocale();
  const shared = useTranslations("auth.shared");
  const reset = useTranslations("auth.passwordReset");
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialPasswordResetConfirmActionState,
  );
  const newPasswordErrorId = "reset-new-password-errors";
  const confirmPasswordErrorId = "reset-confirm-password-errors";

  if (state.successMessage) {
    return (
      <div className="grid gap-5">
        <p className="m-0 rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)] p-3 text-sm font-bold text-[var(--mint)]">
          {state.successMessage}
        </p>
        <Link href="/login" className="btn m-0 w-full">
          {reset("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-5" action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />

      <PasswordField
        autoComplete="new-password"
        errorId={newPasswordErrorId}
        errors={state.fields.newPassword}
        id="newPassword"
        label={reset("newPassword")}
        name="newPassword"
      />
      <PasswordField
        autoComplete="new-password"
        errorId={confirmPasswordErrorId}
        errors={state.fields.confirmPassword}
        id="confirmPassword"
        label={reset("confirmPassword")}
        name="confirmPassword"
      />

      {state.message ? (
        <p className="error-text" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <button className="btn m-0 w-full" type="submit" disabled={pending}>
        <LockKeyhole aria-hidden="true" className="size-4" />
        {pending ? reset("resetSubmitting") : reset("resetSubmit")}
      </button>

      <p className="helper m-0">{shared("passwordHelper")}</p>
    </form>
  );
}

function PasswordField({
  autoComplete,
  errorId,
  errors,
  id,
  label,
  name,
}: {
  autoComplete: string;
  errorId: string;
  errors?: string[];
  id: string;
  label: string;
  name: string;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-shell">
        <LockKeyhole aria-hidden="true" className="size-4 text-[var(--brass)]" />
        <input
          id={id}
          name={name}
          type="password"
          autoComplete={autoComplete}
          className="text-input field-input"
          minLength={authValidationLimits.passwordMinLength}
          maxLength={authValidationLimits.passwordMaxLength}
          aria-label={label}
          aria-describedby={errors ? errorId : undefined}
          aria-invalid={Boolean(errors)}
          required
        />
      </div>
      <FieldErrorList id={errorId} errors={errors} />
    </div>
  );
}
