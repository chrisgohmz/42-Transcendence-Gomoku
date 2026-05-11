"use client";

import { useTranslations } from "next-intl";

import { AvatarToken } from "@/components/gomoku-ui";
import { usePresence } from "@/components/presence-provider";

export default function ProfilePresence({
  username,
  isRevealed = true,
}: {
  username: string;
  isRevealed?: boolean;
}) {
  const { onlineUsers } = usePresence();
  const t = useTranslations("friends");
  const isOnline = isRevealed && onlineUsers.includes(username);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${isOnline ? "bg-[var(--mint)] shadow-[0_0_10px] shadow-[var(--mint)]" : "bg-[var(--muted-strong)]"}`}
      />
      <span
        className={`text-sm font-bold ${isOnline ? "text-[var(--mint)]" : "text-[var(--muted-text)]"}`}
      >
        {isOnline ? t("status.online") : t("status.offline")}
      </span>
    </div>
  );
}

export function LiveAvatar({
  image,
  name,
  size = "md",
  username,
  isRevealed = true,
}: {
  image?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  username: string;
  isRevealed?: boolean;
}) {
  const { onlineUsers } = usePresence();
  const isOnline = isRevealed && onlineUsers.includes(username);

  return <AvatarToken image={image} name={name} online={isOnline} size={size} />;
}
