"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

import { uploadProfilePicture } from "./actions";

export default function ProfilePicture({ initialImage }: { initialImage?: string | null }) {
  const [isHovering, setIsHovering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      setErrorMessage(result.error);
    } else if (result?.success) {
      router.refresh();
    }
  };

  const closeErrorPopup = () => {
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <>
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-slate-700 bg-[#08101F] p-5 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-red-400">Upload Failed</h3>
            <p className="mb-5 text-sm text-slate-300">{errorMessage}</p>
            <button
              onClick={closeErrorPopup}
              className="w-full rounded-xl bg-[#4ee8c2] px-4 py-2.5 text-sm font-bold text-[#04131a] transition-transform hover:-translate-y-0.5"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <div
        className="group relative mb-6 h-[300px] w-[300px] cursor-pointer"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleContainerClick}
      >
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#ccc]">
          {initialImage && (
            <Image src={initialImage} alt={t("alt")} fill sizes="300px" className="object-cover" />
          )}
        </div>
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/40 transition-opacity duration-200 ${isHovering ? "opacity-100" : "opacity-0"}`}
        >
          <Camera className="mb-2 h-10 w-10 text-white" />
          <span className="text-sm font-bold text-white">{t("changePhoto")}</span>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />
      </div>
    </>
  );
}
