"use client";

import { Bot, Home, MessageSquare, Settings, Swords, Trophy, UserRound, Users } from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";

const icons = {
  account: Settings,
  friends: Users,
  game: Bot,
  home: Home,
  human: Swords,
  leaderboard: Trophy,
  messages: MessageSquare,
  profile: UserRound,
} as const;

export type SidebarNavItem = {
  href: string;
  icon: keyof typeof icons;
  label: string;
};

type SidebarNavProps = {
  groups: {
    label: string;
    items: SidebarNavItem[];
  }[];
};

export function SidebarNav({ groups }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="Primary">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="sidebar-nav-label">{group.label}</p>
          <div className="grid gap-1">
            {group.items.map((item) => {
              const Icon = icons[item.icon];
              const isActive =
                item.href === "/"
                  ? pathname === "/" || pathname === "/home"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sidebar-link"
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
