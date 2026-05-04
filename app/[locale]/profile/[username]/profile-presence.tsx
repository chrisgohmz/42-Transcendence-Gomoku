"use client";

import { useTranslations } from "next-intl";

import { usePresence } from "@/components/presence-provider";

export default function ProfilePresence({ username }: { username: string }) {
  const { onlineUsers } = usePresence();
  const t = useTranslations("friends");
  const isOnline = onlineUsers.includes(username);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full shadow-[0_0_5px] ${isOnline ? "bg-[#4ee8c2] shadow-[#4ee8c2]" : "bg-red-500 shadow-[#ef4444]"}`}
      ></span>
      <span className={`text-sm font-bold ${isOnline ? "text-[#4ee8c2]" : "text-red-500"}`}>
        {isOnline ? t("status.online") : t("status.offline")}
      </span>
    </div>
  );
}
