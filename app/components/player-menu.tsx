"use client";

import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

export default function UserMenu() {
  const t = useTranslations("nav.userMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Avatar className="h-9 w-9">
            <AvatarImage src="/icons/Login.svg" alt={t("avatarAlt")} />
            <AvatarFallback>{t("avatarFallback")}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-slate-800 sm:inline">
            {t("trigger")}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/profile">{t("profile")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/friends">{t("friends")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/messages">{t("messages")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>{t("logout")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
