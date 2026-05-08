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
        className={`h-2 w-2 rounded-full shadow-[0_0_10px] ${isOnline ? "bg-[var(--mint)] shadow-[var(--mint)]" : "bg-[var(--danger)] shadow-[var(--danger)]"}`}
      />
      <span
        className={`text-sm font-bold ${isOnline ? "text-[var(--mint)]" : "text-[var(--danger)]"}`}
      >
        {isOnline ? t("status.online") : t("status.offline")}
      </span>
    </div>
  );
}
