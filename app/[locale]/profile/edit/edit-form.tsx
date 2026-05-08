"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";

import { FieldErrorList } from "@/components/field-error-list";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { authValidationLimits } from "@/lib/validation/auth-profile-limits";

import { initialProfileSettingsActionState } from "./action-state";
import { changeAccountPassword, saveDisplayName } from "./actions";

export default function EditProfileForm({
  currentUsername,
  currentDisplayName,
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

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const passwordFormRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const t = useTranslations("profile.edit");

  const displayNameErrorId = "displayName-errors";
  const currentPasswordErrorId = "currentPassword-errors";
  const newPasswordErrorId = "newPassword-errors";
  const confirmPasswordErrorId = "confirmPassword-errors";

  const successMessage = displayNameState.successMessage ?? passwordState.successMessage;

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    if (displayNameState.successMessage) {
      const timer = setTimeout(() => setIsEditingName(false), 1500);
      return () => clearTimeout(timer);
    }

    if (passwordState.successMessage) {
      const timer = setTimeout(() => setIsEditingPassword(false), 1500);
      const form = passwordFormRef.current;
      if (form) {
        const currentPassword = form.elements.namedItem(
          "currentPassword",
        ) as HTMLInputElement | null;
        const newPassword = form.elements.namedItem("newPassword") as HTMLInputElement | null;
        const confirmPassword = form.elements.namedItem(
          "confirmPassword",
        ) as HTMLInputElement | null;

        if (currentPassword) currentPassword.value = "";
        if (newPassword) newPassword.value = "";
        if (confirmPassword) confirmPassword.value = "";
      }
      return () => clearTimeout(timer);
    }

    const timeoutId = window.setTimeout(() => {
      router.push("/profile");
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [displayNameState.successMessage, passwordState.successMessage, router, successMessage]);

  return (
    <div className="mt-8 flex w-full flex-col gap-8 rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e]/90 p-8 text-left shadow-2xl">
      <div className="grid w-full grid-cols-1 gap-16 md:grid-cols-2">
        {/* Left Column: Display Name Form */}
        <form action={displayNameAction} className="flex h-full flex-col gap-6">
          <div className="flex items-center gap-3">
            <h2 className="m-0 font-serif text-xl font-bold text-white">{t("profileDetails")}</h2>
            {!isEditingName && (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="text-[var(--mint)] transition-transform hover:scale-110 hover:text-[var(--mint)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
                aria-label={t("editNameAria")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
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

          <div className="flex flex-col gap-2">
            <label htmlFor="displayName" className="field-label">
              {t("displayName")}
            </label>

            {isEditingName ? (
              <>
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
              </>
            ) : (
              <div className="text-input">{currentDisplayName}</div>
            )}
          </div>

          {displayNameState.message ? (
            <p className="m-0 text-sm text-[var(--danger)]" role="alert">
              {displayNameState.message}
            </p>
          ) : null}

          {displayNameState.successMessage ? (
            <p className="m-0 text-sm text-[var(--mint)]" role="status">
              {displayNameState.successMessage}
            </p>
          ) : null}

          {isEditingName && (
            <div className="mt-auto flex w-full justify-center gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditingName(false);
                }}
                className="px-6 font-bold text-[var(--danger)] hover:bg-[rgb(198_56_47_/_0.15)] hover:text-[var(--danger)]"
              >
                {t("cancel")}
              </Button>
              <Button type="submit" className="w-fit px-8 font-bold" disabled={displayNamePending}>
                {displayNamePending ? t("savingChanges") : t("saveChanges")}
              </Button>
            </div>
          )}
        </form>

        {/* Right Column: Password Form */}
        <form ref={passwordFormRef} action={passwordAction} className="flex h-full flex-col gap-6">
          <div className="flex items-center gap-3">
            <h2 className="m-0 font-serif text-xl font-bold text-white">{t("changePassword")}</h2>
            {!isEditingPassword && (
              <button
                type="button"
                onClick={() => setIsEditingPassword(true)}
                className="text-[var(--mint)] transition-transform hover:scale-110 hover:text-[var(--mint)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
                aria-label={t("editPasswordAria")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isEditingPassword ? (
            <div className="flex flex-col gap-2">
              <label className="field-label">{t("passwordReadonly")}</label>
              <div className="text-input tracking-widest">••••••••••••</div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <label htmlFor="currentPassword" className="field-label">
                  {t("currentPassword")}
                </label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  className="text-input"
                  aria-describedby={
                    passwordState.fields.currentPassword ? currentPasswordErrorId : undefined
                  }
                  aria-invalid={Boolean(passwordState.fields.currentPassword)}
                />
                <FieldErrorList
                  id={currentPasswordErrorId}
                  errors={passwordState.fields.currentPassword}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="newPassword" className="field-label">
                  {t("newPassword")}
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={authValidationLimits.passwordMinLength}
                  maxLength={authValidationLimits.passwordMaxLength}
                  className="text-input"
                  aria-describedby={
                    passwordState.fields.newPassword ? newPasswordErrorId : undefined
                  }
                  aria-invalid={Boolean(passwordState.fields.newPassword)}
                />
                <FieldErrorList id={newPasswordErrorId} errors={passwordState.fields.newPassword} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="confirmPassword" className="field-label">
                  {t("confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={authValidationLimits.passwordMinLength}
                  maxLength={authValidationLimits.passwordMaxLength}
                  className="text-input"
                  aria-describedby={
                    passwordState.fields.confirmPassword ? confirmPasswordErrorId : undefined
                  }
                  aria-invalid={Boolean(passwordState.fields.confirmPassword)}
                />
                <FieldErrorList
                  id={confirmPasswordErrorId}
                  errors={passwordState.fields.confirmPassword}
                />
              </div>

              {passwordState.message ? (
                <p className="m-0 text-sm text-[var(--danger)]" role="alert">
                  {passwordState.message}
                </p>
              ) : null}

              {passwordState.successMessage ? (
                <p className="m-0 text-sm text-[var(--mint)]" role="status">
                  {passwordState.successMessage}
                </p>
              ) : null}

              <div className="mt-auto flex w-full justify-center gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingPassword(false)}
                  className="px-6 font-bold text-[var(--danger)] hover:bg-[rgb(198_56_47_/_0.15)] hover:text-[var(--danger)]"
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" className="w-fit px-8 font-bold" disabled={passwordPending}>
                  {passwordPending ? t("savingChanges") : t("updatePassword")}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
      <div className="mt-4 flex w-full justify-center border-t border-[var(--panel-border-soft)] pt-8">
        <Button
          type="button"
          variant="outline"
          className="px-12 font-bold text-[var(--danger)] hover:bg-[rgb(198_56_47_/_0.15)] hover:text-[var(--danger)]"
          onClick={() => router.push("/profile")}
        >
          {t("returnToProfile")}
        </Button>
      </div>
    </div>
  );
}
