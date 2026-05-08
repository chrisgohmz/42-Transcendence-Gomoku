"use client";

import { User, Users, MessageSquare, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

interface UserMenuProps {
  username?: string;
  avatarUrl?: string | null;
}

export default function UserMenu({ username, avatarUrl }: UserMenuProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const t = useTranslations("nav.userMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 bg-white/[0.04]">
          <Avatar className="h-7 w-7">
            <AvatarImage src={avatarUrl || "/icons/Login.svg"} alt={t("avatarAlt")} />
            <AvatarFallback>{username ? username.charAt(0).toUpperCase() : "U"}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium capitalize sm:inline">
            {username || t("player")}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-52 border-[var(--panel-border)] !bg-[var(--panel-solid)] text-[var(--text)] shadow-[0_24px_70px_rgba(0,0,0,0.58)]"
      >
        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-md text-[var(--muted-text)] focus:bg-white/[0.07] focus:text-[var(--text)]"
        >
          <Link href="/profile" className="flex w-full items-center gap-2">
            <User className="h-4 w-4" />
            <span>{t("profile")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-md text-[var(--muted-text)] focus:bg-white/[0.07] focus:text-[var(--text)]"
        >
          <Link href="/friends" className="flex w-full items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{t("friends")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-md text-[var(--muted-text)] focus:bg-white/[0.07] focus:text-[var(--text)]"
        >
          <Link href="/messages" className="flex w-full items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>{t("messages")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md focus:!bg-[rgb(198_56_47_/_0.15)]"
        >
          <LogOut className="h-4 w-4 text-[var(--danger)]" />
          <span className="font-semibold text-[var(--danger)]">{t("logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
