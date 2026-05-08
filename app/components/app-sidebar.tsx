import {
  BookOpen,
  Bot,
  Home,
  MessageSquare,
  ShieldCheck,
  Swords,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { LocaleSwitcher } from "@/components/locale-switcher";
import UserMenu from "@/components/player-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

const productLinks = [
  { href: "/", icon: Home, labelKey: "home" },
  { href: "/game", icon: Bot, labelKey: "vsAi" },
  { href: "/human", icon: Swords, labelKey: "vsHuman" },
  { href: "/leaderboard", icon: Trophy, labelKey: "leaderboard" },
] as const;

export default async function AppSidebar() {
  const [sessionData, brand, nav] = await Promise.all([
    getCurrentSession(),
    getTranslations("brand"),
    getTranslations("nav"),
  ]);
  const isLoggedIn = sessionData !== null;
  const realUsername = sessionData?.user.username;
  const avatarUrl = sessionData?.user.avatarUrl;
  const socialLinks = [
    { href: "/friends", icon: Users, label: nav("userMenu.friends") },
    { href: "/messages", icon: MessageSquare, label: nav("userMenu.messages") },
    { href: "/profile", icon: UserRound, label: nav("userMenu.profile") },
  ] as const;

  return (
    <>
      <aside className="app-sidebar" aria-label="Primary navigation">
        <Link href="/" className="sidebar-brand">
          <Image src="/icons/Gomoku.svg" alt={brand("logoAlt")} width={52} height={52} priority />
          <span>
            <span className="sidebar-brand-mark" translate="no">
              {brand("name")}
            </span>
            <span className="sidebar-brand-subtitle">Competitive Gomoku</span>
          </span>
        </Link>

        <nav className="sidebar-nav">
          <p className="sidebar-nav-label">Play</p>
          {productLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="sidebar-link">
                <Icon aria-hidden="true" className="size-4" />
                <span>{nav(item.labelKey)}</span>
              </Link>
            );
          })}

          <p className="sidebar-nav-label">Social</p>
          {socialLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="sidebar-link">
                <Icon aria-hidden="true" className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-3">
          <a
            href="https://en.wikipedia.org/wiki/Gomoku"
            className="sidebar-link sidebar-link-muted"
          >
            <BookOpen aria-hidden="true" className="size-4" />
            <span>{nav("rules")}</span>
          </a>

          <div className="sidebar-account">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted-strong)]">
              <ShieldCheck aria-hidden="true" className="size-4 text-[var(--mint)]" />
              Ranked Session
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LocaleSwitcher />
              {isLoggedIn ? (
                <UserMenu username={realUsername} avatarUrl={avatarUrl} />
              ) : (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login">{nav("login")}</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/signup">{nav("signup")}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      <header className="mobile-topbar">
        <Link href="/" className="sidebar-brand min-w-0">
          <Image src="/icons/Gomoku.svg" alt={brand("logoAlt")} width={40} height={40} priority />
          <span className="min-w-0 truncate font-black" translate="no">
            {brand("name")}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          {isLoggedIn ? (
            <UserMenu username={realUsername} avatarUrl={avatarUrl} />
          ) : (
            <Button asChild size="sm">
              <Link href="/login">{nav("login")}</Link>
            </Button>
          )}
        </div>
      </header>
    </>
  );
}
