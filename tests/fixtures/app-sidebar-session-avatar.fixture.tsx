import { expect, mock } from "bun:test";

import { Children, isValidElement, type ReactNode } from "react";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

type PlayerProfileProps = {
  avatarUrl?: string | null;
  className?: string;
  username?: string;
};

type ElementWithChildren = {
  children?: ReactNode;
};

const getTranslations = mock();
const getLocale = mock();
const getCurrentSession = mock();
const getCurrentSessionIdentity = mock();
const countFriendships = mock();
const getUnreadDirectMessageCountForUser = mock();

function MockPlayerProfile(_props: PlayerProfileProps) {
  return null;
}

function MockPlayerLogout(_props: { iconOnly?: boolean }) {
  return null;
}

function MockSidebarNav(_props: {
  groups: Array<{
    items: Array<{ href: string; icon: string; label: string; notificationCount?: number }>;
    label: string;
  }>;
}) {
  return null;
}

function MockLocaleSwitcher() {
  return null;
}

function MockButton(_props: ElementWithChildren) {
  return null;
}

function MockLink(_props: ElementWithChildren & { href: string }) {
  return null;
}

await mock.module("next-intl/server", () => ({
  getLocale,
  getTranslations,
}));

await mock.module("@/components/player-menu", () => ({
  PlayerLogout: MockPlayerLogout,
  PlayerProfile: MockPlayerProfile,
}));

await mock.module("@/components/sidebar-nav", () => ({
  SidebarNav: MockSidebarNav,
}));

await mock.module("@/components/locale-switcher", () => ({
  LocaleSwitcher: MockLocaleSwitcher,
}));

await mock.module("@/components/ui/button", () => ({
  Button: MockButton,
}));

await mock.module("@/i18n/navigation", () => ({
  Link: MockLink,
}));

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
    getCurrentSessionIdentity,
  }),
);

await mock.module("@/lib/chat/unread", () => ({
  getUnreadDirectMessageCountForUser,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    friendship: {
      count: countFriendships,
    },
  },
}));

const { default: AppSidebar } = await import("../../app/components/app-sidebar");

getLocale.mockResolvedValue("en");
getTranslations.mockImplementation(async (namespaceOrOptions: string | { namespace: string }) => {
  const namespace =
    typeof namespaceOrOptions === "string" ? namespaceOrOptions : namespaceOrOptions.namespace;
  return (key: string) => `${namespace}:${key}`;
});
getCurrentSession.mockResolvedValue({
  user: {
    avatarUrl: "/api/avatars/user-ada.png",
    id: "user-ada",
    username: "ada",
  },
});
getCurrentSessionIdentity.mockRejectedValue(new Error("Use the full session for sidebar avatars"));
countFriendships.mockResolvedValue(1);
getUnreadDirectMessageCountForUser.mockResolvedValue(2);

const rendered = await AppSidebar();
const profiles = collectPlayerProfileProps(rendered);

expect(getCurrentSession).toHaveBeenCalledTimes(1);
expect(getCurrentSessionIdentity).not.toHaveBeenCalled();
expect(profiles).toHaveLength(2);
expect(profiles.map((profile) => profile.avatarUrl)).toEqual([
  "/api/avatars/user-ada.png",
  "/api/avatars/user-ada.png",
]);
expect(profiles.map((profile) => profile.username)).toEqual(["ada", "ada"]);

function collectPlayerProfileProps(node: ReactNode) {
  const profiles: PlayerProfileProps[] = [];

  function visit(child: ReactNode) {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }

    if (!isValidElement(child)) {
      return;
    }

    if (child.type === MockPlayerProfile) {
      profiles.push(child.props as PlayerProfileProps);
    }

    Children.forEach((child.props as ElementWithChildren).children, visit);
  }

  visit(node);

  return profiles;
}
