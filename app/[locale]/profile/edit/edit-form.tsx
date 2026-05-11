"use client";

import { LockKeyhole, Save, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";

import { FieldErrorList } from "@/components/field-error-list";
import { Surface } from "@/components/gomoku-ui";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

import { initialProfileSettingsActionState } from "./action-state";
import { changeAccountPassword, saveDisplayName } from "./actions";

export default function EditProfileForm({
  currentDisplayName,
  currentUsername,
}: {
  currentUsername: string;
  currentDisplayName: string;
}) {
  const [displayNameState, displayNameAction, displayNamePending] = useActionState(
    saveDisplayName,
    initialProfileSettingsActionState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changeAccountPassword,
    initialProfileSettingsActionState,
  );

  const passwordFormRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const t = useTranslations("profile.edit");

  const displayNameErrorId = "displayName-errors";
  const currentPasswordErrorId = "currentPassword-errors";
  const newPasswordErrorId = "newPassword-errors";
  const confirmPasswordErrorId = "confirmPassword-errors";

  useEffect(() => {
    if (!passwordState.successMessage) return;
    const form = passwordFormRef.current;
    if (!form) return;
    form.reset();
  }, [passwordState.successMessage]);

  return (
    <div className="grid gap-5">
      <Surface eyebrow="Basic Information" icon={UserRound} title={t("profileDetails")}>
        <form action={displayNameAction} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="username" className="field-label">
                {t("usernameReadonly")}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                defaultValue={currentUsername}
                autoComplete="username"
                className="text-input cursor-not-allowed text-[var(--muted-text)] opacity-70"
                readOnly
              />
            </div>

            <div className="field">
              <label htmlFor="displayName" className="field-label">
                {t("displayName")}
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                defaultValue={currentDisplayName}
                maxLength={authValidationLimits.displayNameMaxLength}
                autoComplete="name"
                className="text-input"
                aria-describedby={
                  displayNameState.fields.displayName ? displayNameErrorId : undefined
                }
                aria-invalid={Boolean(displayNameState.fields.displayName)}
                required
              />
              <FieldErrorList
                id={displayNameErrorId}
                errors={displayNameState.fields.displayName}
              />
            </div>
          </div>

          {displayNameState.message ? (
            <p className="m-0 text-sm font-bold text-[var(--danger)]" role="alert">
              {displayNameState.message}
            </p>
          ) : null}

          {displayNameState.successMessage ? (
            <p className="m-0 text-sm font-bold text-[var(--mint)]" role="status">
              {displayNameState.successMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={displayNamePending} className="h-12 px-5 font-black">
              <Save aria-hidden="true" className="size-4" />
              {displayNamePending ? t("savingChanges") : t("saveChanges")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/profile")}
              className="h-12 px-5 font-black"
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </Surface>

      <Surface eyebrow="Security" icon={LockKeyhole} title={t("changePassword")}>
        <form ref={passwordFormRef} action={passwordAction} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <PasswordField
              errorId={currentPasswordErrorId}
              errors={passwordState.fields.currentPassword}
              id="currentPassword"
              label={t("currentPassword")}
              name="currentPassword"
              autoComplete="current-password"
            />
            <PasswordField
              errorId={newPasswordErrorId}
              errors={passwordState.fields.newPassword}
              id="newPassword"
              label={t("newPassword")}
              name="newPassword"
              autoComplete="new-password"
            />
            <PasswordField
              errorId={confirmPasswordErrorId}
              errors={passwordState.fields.confirmPassword}
              id="confirmPassword"
              label={t("confirmPassword")}
              name="confirmPassword"
              autoComplete="new-password"
            />
          </div>

          {passwordState.message ? (
            <p className="m-0 text-sm font-bold text-[var(--danger)]" role="alert">
              {passwordState.message}
            </p>
          ) : null}

          {passwordState.successMessage ? (
            <p className="m-0 text-sm font-bold text-[var(--mint)]" role="status">
              {passwordState.successMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={passwordPending} className="h-12 px-5 font-black">
              <LockKeyhole aria-hidden="true" className="size-4" />
              {passwordPending ? t("savingChanges") : t("updatePassword")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/profile")}
              className="h-12 px-5 font-black"
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </Surface>
    </div>
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
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        minLength={authValidationLimits.passwordMinLength}
        maxLength={authValidationLimits.passwordMaxLength}
        className="text-input"
        aria-describedby={errors ? errorId : undefined}
        aria-invalid={Boolean(errors)}
      />
      <FieldErrorList id={errorId} errors={errors} />
    </div>
  );
}
