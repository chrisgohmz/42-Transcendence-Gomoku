"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

import { seedProfileAvatars } from "@/lib/seed-avatars";

import { selectSeedProfilePicture, uploadProfilePicture } from "./actions";

export default function ProfilePicture({ initialImage }: { initialImage?: string | null }) {
  const [isHovering, setIsHovering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openFilePickerOnErrorClose, setOpenFilePickerOnErrorClose] = useState(false);
  const [pendingSeedAvatar, setPendingSeedAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("profile.picture");
  const router = useRouter();

  const handleContainerClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadProfilePicture(formData);

    if (result?.error) {
      setOpenFilePickerOnErrorClose(true);
      setErrorMessage(result.error);
    } else if (result?.success) {
      router.refresh();
    }
  };

  const handleSeedAvatarClick = async (avatarUrl: string) => {
    setPendingSeedAvatar(avatarUrl);
    setErrorMessage(null);

    try {
      const result = await selectSeedProfilePicture(avatarUrl);

      if (result?.error) {
        setOpenFilePickerOnErrorClose(false);
        setErrorMessage(result.error);
      } else if (result?.success) {
        router.refresh();
      }
    } finally {
      setPendingSeedAvatar(null);
    }
  };

  const closeErrorPopup = () => {
    setErrorMessage(null);
    if (openFilePickerOnErrorClose && fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
    setOpenFilePickerOnErrorClose(false);
  };

  return (
    <>
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e] p-5 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-[var(--danger)]">Upload Failed</h3>
            <p className="mb-5 text-sm text-[var(--muted-text)]">{errorMessage}</p>
            <button
              type="button"
              onClick={closeErrorPopup}
              className="btn m-0 w-full px-4 py-2.5 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="group relative mb-6 aspect-square w-full max-w-[240px] cursor-pointer overflow-hidden rounded-full border border-[var(--brass)]/35 shadow-lg shadow-[#000000]/50 focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none sm:max-w-[300px]"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleContainerClick}
        aria-label={t("changePhoto")}
      >
        <div
          className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full ${initialImage ? "bg-transparent" : "bg-white/[0.08]"}`}
        >
          {initialImage && (
            <Image src={initialImage} alt={t("alt")} fill sizes="300px" className="object-cover" />
          )}
        </div>
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/40 transition-opacity duration-200 ${isHovering ? "opacity-100" : "opacity-0"}`}
        >
          <Camera aria-hidden="true" className="mb-2 h-10 w-10 text-white" />
          <span className="text-sm font-bold text-white">{t("changePhoto")}</span>
        </div>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t("changePhoto")}
      />
      <div className="grid w-full max-w-[300px] grid-cols-7 gap-2">
        {seedProfileAvatars.map((avatar) => {
          const isSelected = initialImage === avatar.url;
          const isPending = pendingSeedAvatar === avatar.url;

          return (
            <button
              key={avatar.url}
              type="button"
              aria-label={t("chooseBuiltIn", { name: avatar.name })}
              title={t("chooseBuiltIn", { name: avatar.name })}
              disabled={Boolean(pendingSeedAvatar)}
              onClick={() => handleSeedAvatarClick(avatar.url)}
              className={`relative aspect-square overflow-hidden rounded-full border bg-white/[0.06] transition focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 ${
                isSelected
                  ? "border-[var(--mint)] shadow-[0_0_0_2px_rgb(93_215_166_/_0.22)]"
                  : "border-[var(--panel-border-soft)] hover:border-[var(--brass)]/70"
              }`}
            >
              <Image
                src={avatar.url}
                alt=""
                fill
                sizes="42px"
                className={`object-cover ${isPending ? "animate-pulse" : ""}`}
                unoptimized
              />
            </button>
          );
        })}
      </div>
    </>
  );
}
