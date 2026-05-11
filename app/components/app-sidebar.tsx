import { BookOpen, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { PlayerProfile, PlayerLogout } from "@/components/player-menu";
import { SidebarNav, type SidebarNavItem } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const productLinkMeta = [
  { href: "/", icon: "home", labelKey: "home" },
  { href: "/game", icon: "game", labelKey: "vsAi" },
  { href: "/human", icon: "human", labelKey: "vsHuman" },
  { href: "/leaderboard", icon: "leaderboard", labelKey: "leaderboard" },
] as const satisfies ReadonlyArray<Omit<SidebarNavItem, "label"> & { labelKey: string }>;

export default async function AppSidebar() {
  const [sessionData, brand, nav] = await Promise.all([
    getCurrentSession(),
    getTranslations("brand"),
    getTranslations("nav"),
  ]);

  const isLoggedIn = sessionData !== null;
  const realUsername = sessionData?.user.username;
  const avatarUrl = sessionData?.user.avatarUrl;

  let pendingFriendsCount = 0;
  if (sessionData) {
    const pendingCount = await prisma.friendship.count({
      where: {
        OR: [{ userLowId: sessionData.user.id }, { userHighId: sessionData.user.id }],
        status: "PENDING",
        NOT: { requestedById: sessionData.user.id },
      },
    });
    pendingFriendsCount = pendingCount;
  }

  const productLinks = productLinkMeta.map(({ href, icon, labelKey }) => ({
    href,
    icon,
    label: nav(labelKey),
  }));

  const socialLinks: SidebarNavItem[] = [
    {
      href: "/friends",
      icon: "friends",
      label: nav("userMenu.friends"),
      notificationCount: pendingFriendsCount,
    },
    { href: "/messages", icon: "messages", label: nav("userMenu.messages") },
    { href: "/profile", icon: "profile", label: nav("userMenu.profile") },
    // { href: "/account", icon: "account", label: "Settings" },
  ];

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

        <SidebarNav
          groups={[
            { label: "Play", items: productLinks },
            { label: "Social", items: socialLinks },
          ]}
        />

        <div className="mt-auto grid gap-3">
          <a
            href="https://en.wikipedia.org/wiki/Gomoku"
            className="sidebar-link sidebar-link-muted"
          >
            <BookOpen aria-hidden="true" className="size-4" />
            <span>{nav("rules")}</span>
          </a>

          <div className="sidebar-account">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--muted-strong)]">
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="size-4 text-[var(--mint)]" />
                <span>Ranked Session</span>
              </div>
              <div className="-mr-2">
                <LocaleSwitcher />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {isLoggedIn ? (
                <div className="flex w-full gap-2">
                  <PlayerProfile
                    username={realUsername}
                    avatarUrl={avatarUrl}
                    className="flex-1 overflow-hidden"
                  />
                  <PlayerLogout iconOnly />
                </div>
              ) : (
                <div className="flex w-full gap-2">
                  <Button asChild variant="ghost" size="sm" className="flex-1">
                    <Link href="/login">{nav("login")}</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link href="/signup">{nav("signup")}</Link>
                  </Button>
                </div>
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
          {isLoggedIn ? (
            <>
              <PlayerProfile username={realUsername} avatarUrl={avatarUrl} />
              <LocaleSwitcher />
              <PlayerLogout iconOnly />
            </>
          ) : (
            <>
              <LocaleSwitcher />
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{nav("login")}</Link>
              </Button>
            </>
          )}
        </div>
      </header>
    </>
  );
}
