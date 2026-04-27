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
        <Button className="flex items-center gap-2 border-0 bg-slate-800 text-white hover:bg-slate-700">
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
        className="w-48 border-slate-700 bg-[#0b182d] text-slate-200"
      >
        <DropdownMenuItem
          asChild
          className="cursor-pointer text-slate-200 hover:bg-slate-700 hover:text-white focus:bg-slate-200 focus:text-white"
        >
          <Link href="/profile" className="flex w-full items-center gap-2">
            <User className="h-4 w-4" />
            <span>{t("profile")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer text-slate-200 hover:bg-slate-700 hover:text-white focus:bg-slate-200 focus:text-white"
        >
          <Link href="/friends" className="flex w-full items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{t("friends")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer text-slate-200 hover:bg-slate-700 hover:text-white focus:bg-slate-200 focus:text-white"
        >
          <Link href="/messages" className="flex w-full items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>{t("messages")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-2 focus:bg-slate-200!"
        >
          <LogOut className="h-4 w-4 text-red-700" />
          <span className="font-semibold text-red-700">{t("logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
