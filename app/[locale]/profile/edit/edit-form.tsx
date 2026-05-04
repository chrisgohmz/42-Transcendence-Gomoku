"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";

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

    const form = passwordFormRef.current;
    if (passwordState.successMessage && form) {
      const currentPassword = form.elements.namedItem("currentPassword") as HTMLInputElement | null;
      const newPassword = form.elements.namedItem("newPassword") as HTMLInputElement | null;
      const confirmPassword = form.elements.namedItem("confirmPassword") as HTMLInputElement | null;

      if (currentPassword) {
        currentPassword.value = "";
      }

      if (newPassword) {
        newPassword.value = "";
      }

      if (confirmPassword) {
        confirmPassword.value = "";
      }
    }
    const timeoutId = window.setTimeout(() => {
      router.push("/profile");
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [passwordState.successMessage, router, successMessage]);

  return (
    <div className="mt-8 flex w-full flex-col gap-8 rounded-xl border border-slate-700/50 bg-[#08101F] p-8 text-left shadow-2xl">
      <div className="grid w-full grid-cols-1 gap-16 md:grid-cols-2">
        <form action={displayNameAction} className="flex flex-col gap-6">
          <h2 className="m-0 text-xl font-bold text-white">{t("profileDetails")}</h2>

          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-sm font-bold text-slate-300">
              {t("usernameReadonly")}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              defaultValue={currentUsername}
              className="cursor-not-allowed rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-slate-500"
              readOnly
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="displayName" className="text-sm font-bold text-slate-300">
              {t("displayName")}
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              defaultValue={currentDisplayName}
              maxLength={authValidationLimits.displayNameMaxLength}
              className="rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
              aria-describedby={
                displayNameState.fields.displayName ? displayNameErrorId : undefined
              }
              aria-invalid={Boolean(displayNameState.fields.displayName)}
              required
            />
            <FieldErrorList id={displayNameErrorId} errors={displayNameState.fields.displayName} />
          </div>

          {displayNameState.message ? (
            <p className="m-0 text-sm text-red-400" role="alert">
              {displayNameState.message}
            </p>
          ) : null}
          {displayNameState.successMessage ? (
            <p className="m-0 text-sm text-[#4ee8c2]" role="status">
              {displayNameState.successMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            className="mt-auto w-fit bg-[#4ee8c2] px-8 font-bold text-[#04131a] hover:bg-[#4ee8c2]/90"
            disabled={displayNamePending}
          >
            {displayNamePending ? t("savingChanges") : t("saveChanges")}
          </Button>
        </form>

        <form ref={passwordFormRef} action={passwordAction} className="flex flex-col gap-6">
          <h2 className="m-0 text-xl font-bold text-white">{t("changePassword")}</h2>
          <p className="m-0 text-sm text-slate-400">{t("passwordHelp")}</p>

          <div className="flex flex-col gap-2">
            <label htmlFor="currentPassword" className="text-sm font-bold text-slate-300">
              {t("currentPassword")}
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              className="rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
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
            <label htmlFor="newPassword" className="text-sm font-bold text-slate-300">
              {t("newPassword")}
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              minLength={authValidationLimits.passwordMinLength}
              maxLength={authValidationLimits.passwordMaxLength}
              className="rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
              aria-describedby={passwordState.fields.newPassword ? newPasswordErrorId : undefined}
              aria-invalid={Boolean(passwordState.fields.newPassword)}
            />
            <FieldErrorList id={newPasswordErrorId} errors={passwordState.fields.newPassword} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-sm font-bold text-slate-300">
              {t("confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={authValidationLimits.passwordMinLength}
              maxLength={authValidationLimits.passwordMaxLength}
              className="rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
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
            <p className="m-0 text-sm text-red-400" role="alert">
              {passwordState.message}
            </p>
          ) : null}
          {passwordState.successMessage ? (
            <p className="m-0 text-sm text-[#4ee8c2]" role="status">
              {passwordState.successMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            className="mt-auto w-fit bg-[#4ee8c2] px-8 font-bold text-[#04131a] hover:bg-[#4ee8c2]/90"
            disabled={passwordPending}
          >
            {passwordPending ? t("savingChanges") : t("saveChanges")}
          </Button>
        </form>
      </div>

      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="border-slate-700/50 px-6 text-slate-300 hover:bg-slate-800"
          onClick={() => router.push("/profile")}
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
