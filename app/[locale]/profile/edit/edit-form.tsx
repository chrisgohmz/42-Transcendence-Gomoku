"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

import { saveAccountSettings } from "./actions";

export default function EditProfileForm({
  currentUsername,
  currentDisplayName,
}: {
  currentUsername: string;
  currentDisplayName: string;
}) {
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();
  const t = useTranslations("profile.edit");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await saveAccountSettings(formData);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccessMessage(result.success);
      (form.elements.namedItem("currentPassword") as HTMLInputElement).value = "";
      (form.elements.namedItem("newPassword") as HTMLInputElement).value = "";
      (form.elements.namedItem("confirmPassword") as HTMLInputElement).value = "";

      setTimeout(() => {
        router.push("/profile");
      }, 1500);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex w-full flex-col gap-8 rounded-xl border border-slate-700/50 bg-[#08101F] p-8 text-left shadow-2xl"
    >
      <div className="grid w-full grid-cols-1 gap-16 md:grid-cols-2">
        {/* Left Column: Profile Section */}
        <div className="flex flex-col gap-6">
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
              className="rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Right Column: Password Section */}
        <div className="flex flex-col gap-6">
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
              className="rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-sm font-bold text-slate-300">
              {t("confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {error && <p className="m-0 text-center text-sm text-red-400">{error}</p>}
      {successMessage && <p className="m-0 text-center text-sm text-[#4ee8c2]">{successMessage}</p>}

      {/* Single Main Button Group */}
      <div className="mt-2 flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          className="border-slate-700/50 px-6 text-slate-300 hover:bg-slate-800"
          onClick={() => router.push("/profile")}
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          className="bg-[#4ee8c2] px-8 font-bold text-[#04131a] hover:bg-[#4ee8c2]/90"
        >
          {t("saveChanges")}
        </Button>
      </div>
    </form>
  );
}
