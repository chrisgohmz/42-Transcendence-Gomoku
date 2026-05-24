"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { signOutCurrentSession } from "@/lib/auth-client";

interface UserProps {
  username?: string;
  avatarUrl?: string | null;
  className?: string;
}

export function PlayerProfile({ username, avatarUrl, className }: UserProps) {
  const t = useTranslations("nav.userMenu");

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={`flex items-center justify-start gap-2 bg-white/[0.04] px-2 ${className || ""}`}
    >
      <Link href="/profile">
        <Avatar className="h-6 w-6">
          <AvatarImage src={avatarUrl || "/icons/Login.svg"} alt={t("avatarAlt")} />
          <AvatarFallback>{username ? username.charAt(0).toUpperCase() : "U"}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-medium capitalize">{username || t("player")}</span>
      </Link>
    </Button>
  );
}

export function PlayerLogout({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const router = useRouter();
  const t = useTranslations("nav.userMenu");

  const handleLogout = async () => {
    try {
      await signOutCurrentSession();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      onClick={handleLogout}
      title={t("logout")}
      className={`flex items-center gap-2 text-[var(--danger)] hover:bg-[rgb(198_56_47_/_0.15)] hover:text-[var(--danger)] ${
        iconOnly ? "h-8 w-8 justify-center" : "w-full justify-center"
      } ${className || ""}`}
    >
      <LogOut className="h-4 w-4" />
      {!iconOnly && <span>{t("logout")}</span>}
      {iconOnly && <span className="sr-only">{t("logout")}</span>}
    </Button>
  );
}
