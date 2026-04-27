"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { uploadProfilePicture } from "./actions";

export default function ProfilePicture({ initialImage }: { initialImage?: string | null }) {
  const [isHovering, setIsHovering] = useState(false);
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
      alert(result.error);
    } else if (result?.success) {
      router.refresh();
    }
  };

  return (
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
  );
}
