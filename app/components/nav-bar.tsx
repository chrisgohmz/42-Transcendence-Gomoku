import { BookOpen, Bot, Home, Swords, Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { PlayerProfile } from "@/components/player-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

export default async function Navbar() {
  const [sessionData, brand, nav] = await Promise.all([
    getCurrentSession(),
    getTranslations("brand"),
    getTranslations("nav"),
  ]);
  const isLoggedIn = sessionData !== null;
  const realUsername = sessionData?.user.username;
  const avatarUrl = sessionData?.user.avatarUrl;
  const navItems = [
    { href: "/", icon: Home, label: nav("home") },
    { href: "/game", icon: Bot, label: nav("vsAi") },
    { href: "/human", icon: Swords, label: nav("vsHuman") },
    { href: "/leaderboard", icon: Trophy, label: nav("leaderboard") },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--panel-border-soft)] bg-[#050807]/90 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1 transition-[background-color,transform] hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none active:scale-[0.98]"
        >
          <Image
            src="/icons/Gomoku.svg"
            alt={brand("logoAlt")}
            width={42}
            height={42}
            className="rounded-md"
          />
          <span className="truncate text-base font-black text-[var(--text)]" translate="no">
            {brand("name")}
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="hidden items-center gap-1 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-1 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold text-[var(--muted-text)] transition-[background-color,color] hover:bg-white/[0.06] hover:text-[var(--text)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <a
            href="https://en.wikipedia.org/wiki/Gomoku"
            className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[var(--muted-text)] transition-[background-color,color] hover:bg-white/[0.06] hover:text-[var(--text)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none sm:inline-flex"
          >
            <BookOpen aria-hidden="true" className="size-4" />
            {nav("rules")}
          </a>

          <LocaleSwitcher />

          {!isLoggedIn ? (
            <>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href="/login">{nav("login")}</Link>
              </Button>

              <Button asChild>
                <Link href="/signup">{nav("signup")}</Link>
              </Button>
            </>
          ) : (
            <div className="flex items-center">
              <PlayerProfile username={realUsername} avatarUrl={avatarUrl} />
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
