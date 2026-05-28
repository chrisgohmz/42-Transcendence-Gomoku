"use client";

import { LockKeyhole, Save, UserRound, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";

import { FieldErrorList } from "@/components/field-error-list";
import { Surface } from "@/components/gomoku-ui";
import { Button } from "@/components/ui/button";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

import { initialProfileSettingsActionState } from "./action-state";
import { changeAccountPassword, saveDisplayName, setAccountPassword } from "./actions";

export default function EditProfileForm({
  currentDisplayName,
  currentEmail,
  currentUsername,
  hasPassword,
}: {
  currentUsername: string;
  currentDisplayName: string;
  currentEmail: string | null;
  hasPassword: boolean;
}) {
  const [displayNameState, displayNameAction, displayNamePending] = useActionState(
    saveDisplayName,
    initialProfileSettingsActionState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changeAccountPassword,
    initialProfileSettingsActionState,
  );
  const [setPasswordState, setPasswordAction, setPasswordPending] = useActionState(
    setAccountPassword,
    initialProfileSettingsActionState,
  );

  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const passwordFormRef = useRef<HTMLFormElement>(null);
  const t = useTranslations("profile.edit");

  const hasCredentialPassword = hasPassword || Boolean(setPasswordState.successMessage);
  const accountEmail = currentEmail ?? t("emailMissing");
  const activePasswordState = hasCredentialPassword ? passwordState : setPasswordState;
  const activePasswordAction = hasCredentialPassword ? passwordAction : setPasswordAction;
  const activePasswordPending = hasCredentialPassword ? passwordPending : setPasswordPending;
  const passwordSuccessMessage = passwordState.successMessage ?? setPasswordState.successMessage;
  const displayNameErrorId = "displayName-errors";
  const currentPasswordErrorId = "currentPassword-errors";
  const newPasswordErrorId = "newPassword-errors";
  const confirmPasswordErrorId = "confirmPassword-errors";

  // When Display Name saves successfully, close the form
  useEffect(() => {
    if (displayNameState.successMessage) {
      setIsEditingDisplayName(false);
    }
  }, [displayNameState.successMessage]);

  // When Password saves successfully, close the form and clear out the secure inputs
  useEffect(() => {
    if (passwordState.successMessage || setPasswordState.successMessage) {
      setIsEditingPassword(false);
      const form = passwordFormRef.current;
      if (form) form.reset();
    }
  }, [passwordState.successMessage, setPasswordState.successMessage]);

  return (
    <div className="grid gap-5">
      <Surface eyebrow={t("basicInformation")} icon={UserRound} title={t("profileDetails")}>
        {!isEditingDisplayName ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-4">
              <div className="grid gap-1">
                <span className="text-sm font-bold text-[var(--muted-text)]">
                  {t("usernameReadonly")}
                </span>
                <span className="font-medium">@{currentUsername}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-4">
              <div className="grid min-w-0 gap-1">
                <span className="text-sm font-bold text-[var(--muted-text)]">
                  {t("linkedEmailReadonly")}
                </span>
                <span className="truncate font-medium">{accountEmail}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-4">
              <div className="grid gap-1">
                <span className="text-sm font-bold text-[var(--muted-text)]">
                  {t("displayName")}
                </span>
                <span className="font-medium">{currentDisplayName}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingDisplayName(true)}
                className="h-10 px-4 font-black"
              >
                <Pencil aria-hidden="true" className="mr-2 size-4" />
                {t("edit")}
              </Button>
            </div>

            {displayNameState.successMessage ? (
              <output className="m-0 block text-sm font-bold text-[var(--mint)]">
                {displayNameState.successMessage}
              </output>
            ) : null}
          </div>
        ) : (
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
                  className="text-input cursor-not-allowed opacity-70"
                  aria-label={t("usernameReadonly")}
                  readOnly
                />
              </div>

              <div className="field">
                <label htmlFor="email" className="field-label">
                  {t("linkedEmailReadonly")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  defaultValue={accountEmail}
                  autoComplete="email"
                  className="text-input cursor-not-allowed opacity-70"
                  aria-label={t("linkedEmailReadonly")}
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
                  aria-label={t("displayName")}
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

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={displayNamePending} className="h-12 px-5 font-black">
                <Save aria-hidden="true" className="size-4" />
                {displayNamePending ? t("savingChanges") : t("saveChanges")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingDisplayName(false)}
                className="h-12 px-5 font-black"
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        )}
      </Surface>

      <Surface
        eyebrow={t("security")}
        icon={LockKeyhole}
        title={hasCredentialPassword ? t("changePassword") : t("setPassword")}
      >
        {!isEditingPassword ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-4">
              <div className="grid gap-1">
                <span className="text-sm font-bold text-[var(--muted-text)]">
                  {t("passwordReadonly")}
                </span>
                <span
                  className={
                    hasCredentialPassword
                      ? "mt-1 font-medium tracking-[0.2em] text-[var(--muted-text)]"
                      : "mt-1 font-medium text-[var(--muted-text)]"
                  }
                >
                  {hasCredentialPassword ? "••••••••" : t("passwordNotSet")}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingPassword(true)}
                className="h-10 px-4 font-black"
              >
                <Pencil aria-hidden="true" className="mr-2 size-4" />
                {hasCredentialPassword ? t("change") : t("set")}
              </Button>
            </div>

            {passwordSuccessMessage ? (
              <output className="m-0 block text-sm font-bold text-[var(--mint)]">
                {passwordSuccessMessage}
              </output>
            ) : null}
          </div>
        ) : (
          <form ref={passwordFormRef} action={activePasswordAction} className="grid gap-4">
            <div
              className={`grid gap-4 ${hasCredentialPassword ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              {hasCredentialPassword ? (
                <PasswordField
                  errorId={currentPasswordErrorId}
                  errors={activePasswordState.fields.currentPassword}
                  id="currentPassword"
                  label={t("currentPassword")}
                  name="currentPassword"
                  autoComplete="current-password"
                />
              ) : null}
              <PasswordField
                errorId={newPasswordErrorId}
                errors={activePasswordState.fields.newPassword}
                id="newPassword"
                label={t("newPassword")}
                name="newPassword"
                autoComplete="new-password"
              />
              <PasswordField
                errorId={confirmPasswordErrorId}
                errors={activePasswordState.fields.confirmPassword}
                id="confirmPassword"
                label={t("confirmPassword")}
                name="confirmPassword"
                autoComplete="new-password"
              />
            </div>

            {activePasswordState.message ? (
              <p className="m-0 text-sm font-bold text-[var(--danger)]" role="alert">
                {activePasswordState.message}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={activePasswordPending}
                className="h-12 px-5 font-black"
              >
                <LockKeyhole aria-hidden="true" className="size-4" />
                {activePasswordPending
                  ? t("savingChanges")
                  : hasCredentialPassword
                    ? t("updatePassword")
                    : t("setPassword")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingPassword(false)}
                className="h-12 px-5 font-black"
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        )}
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
        aria-label={label}
        aria-describedby={errors ? errorId : undefined}
        aria-invalid={Boolean(errors)}
      />
      <FieldErrorList id={errorId} errors={errors} />
    </div>
  );
}
