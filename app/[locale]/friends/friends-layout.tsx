"use client";

import { Check, MessageSquare, Search, Swords, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Form from "next/form";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvatarToken, Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { usePresence } from "@/components/presence-provider";
import { Link } from "@/i18n/navigation";

import { removeFriend, respondToRequest, sendFriendRequest } from "./actions";

type FriendStats = {
  wins: number;
  losses: number;
  matchesPlayed: number;
  rating: number | null;
} | null;

type FriendData = {
  id: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stats: FriendStats;
};

type SearchUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type FriendsContentProps = {
  friends: FriendData[];
  pendingRequests: FriendData[];
  sentRequests: FriendData[];
  searchQuery: string;
  searchResults: SearchUser[];
};

type TabKey = "friends" | "pending" | "sent";

export default function FriendsContent({
  friends,
  pendingRequests,
  searchQuery,
  searchResults,
  sentRequests,
}: FriendsContentProps) {
  const { onlineUsers, socket } = usePresence();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("friends");

  const [activeTab, setActiveTab] = useState<TabKey>("friends");

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const [searchValue, setSearchValue] = useState(searchQuery);

  useEffect(() => {
    if (!socket) return;

    socket.on("friendship:refresh", () => {
      router.refresh();
    });

    return () => {
      socket.off("friendship:refresh");
    };
  }, [socket, router]);

  useEffect(() => {
    if (!statusMessage) return;

    const timer = setTimeout(() => {
      setStatusMessage(null);
    }, 1800);

    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = searchValue.trim();
      if (query.length >= 3) {
        if (query !== searchQuery) {
          router.replace(`${pathname}?query=${encodeURIComponent(query)}`, { scroll: false });
        }
      } else if (searchQuery !== "") {
        router.replace(pathname, { scroll: false });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, searchQuery, pathname, router]);

  const handleSendRequest = async (targetUsername: string) => {
    setStatusMessage(null);

    const result = await sendFriendRequest(targetUsername);

    if (result?.error) {
      setStatusMessage({
        text: result.error,
        isError: true,
      });

      return;
    }

    setStatusMessage({
      text: t("messages.requestSent", {
        name: targetUsername,
      }),
      isError: false,
    });

    socket?.emit("friendship:notify", targetUsername);

    router.replace(pathname, {
      scroll: false,
    });
  };

  const handleRespond = async (friendshipId: number, accept: boolean) => {
    const request =
      pendingRequests.find((item) => item.id === friendshipId) ||
      sentRequests.find((item) => item.id === friendshipId);

    await respondToRequest(friendshipId, accept);

    if (request) {
      socket?.emit("friendship:notify", request.username);
    }

    router.refresh();
  };

  const handleRemove = async (friendshipId: number) => {
    if (!window.confirm("Are you sure you want to remove this friend?")) {
      return;
    }

    const friend = friends.find((item) => item.id === friendshipId);

    await removeFriend(friendshipId);

    if (friend) {
      socket?.emit("friendship:notify", friend.username);
    }

    router.refresh();
  };

  const activeRows =
    activeTab === "friends" ? friends : activeTab === "pending" ? pendingRequests : sentRequests;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Friends"
        icon={Users}
        title={t("title")}
        lede="Manage friends, answer requests, and jump into chat or challenge."
      />

      {statusMessage ? (
        <p
          className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${
            statusMessage.isError
              ? "border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.16)] text-[var(--danger)]"
              : "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]"
          }`}
          role={statusMessage.isError ? "alert" : "status"}
          aria-live="polite"
        >
          {statusMessage.text}
        </p>
      ) : null}

      <section className="grid gap-5">
        <Surface
          eyebrow="Roster"
          title={
            activeTab === "friends"
              ? "Friends Table"
              : activeTab === "pending"
                ? "Pending Requests"
                : "Sent Requests"
          }
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1">
              {[
                {
                  key: "friends",
                  label: t("tabs.friends"),
                  count: friends.length,
                },
                {
                  key: "pending",
                  label: t("tabs.pending"),
                  count: pendingRequests.length,
                },
                {
                  key: "sent",
                  label: t("tabs.sent"),
                  count: sentRequests.length,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`min-h-10 rounded-sm px-4 text-sm font-black ${
                    activeTab === tab.key
                      ? "bg-[var(--mint-soft)] text-[var(--mint)]"
                      : "text-[var(--muted-text)]"
                  }`}
                >
                  {tab.label} <span className="tabular-nums">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* SEARCH */}
            <div className="relative w-full max-w-sm">
              <Form action="" scroll={false} className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="size-4 text-[var(--muted-text)]" />
                </div>
                <input
                  id="friend-search"
                  name="query"
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  autoComplete="off"
                  className="text-input h-10 w-full pr-3"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </Form>

              {/* FLOATING SEARCH RESULTS */}
              {searchValue.trim().length >= 3 && searchValue === searchQuery && (
                <div className="absolute top-full left-0 z-50 mt-2 w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-solid)] p-2 shadow-xl">
                  {searchResults.length === 0 ? (
                    <p className="p-2 text-sm font-bold text-[var(--danger)]">
                      {t("empty.search")}
                    </p>
                  ) : (
                    <div className="grid gap-1">
                      {searchResults.map((user) => (
                        <article
                          key={user.id}
                          className="flex items-center gap-3 rounded-sm p-2 hover:bg-white/[0.05]"
                        >
                          <AvatarToken size="sm" image={user.avatarUrl} name={user.displayName} />

                          <div className="min-w-0 flex-1">
                            <UserName user={user} />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSendRequest(user.username)}
                            className="btn btn-subtle m-0 h-8 px-2 text-xs"
                          >
                            <UserPlus className="size-3" />
                            {t("actions.add")}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {activeRows.length === 0 ? (
            <EmptyState
              label={
                activeTab === "friends"
                  ? t("empty.friends")
                  : activeTab === "pending"
                    ? t("empty.pending")
                    : t("empty.sent")
              }
            />
          ) : (
            <FriendsTable
              activeTab={activeTab}
              friends={activeRows}
              onlineUsers={onlineUsers}
              onRemove={handleRemove}
              onRespond={handleRespond}
            />
          )}
        </Surface>
      </section>
    </PageShell>
  );
}

function FriendsTable({
  activeTab,
  friends,
  onlineUsers,
  onRemove,
  onRespond,
}: {
  activeTab: TabKey;
  friends: FriendData[];
  onlineUsers: string[];
  onRemove: (id: number) => void;
  onRespond: (id: number, accept: boolean) => void;
}) {
  return (
    <div
      className="overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]"
      data-testid="friends-table"
    >
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[minmax(220px,1fr)_110px_100px_80px_80px_92px_170px] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
          <span>Player</span>
          <span>Rating</span>
          <span>Win Rate</span>
          <span>Wins</span>
          <span>Losses</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {friends.map((friend) => {
          const wins = friend.stats?.wins ?? 0;
          const losses = friend.stats?.losses ?? 0;
          const played = friend.stats?.matchesPlayed ?? 0;

          const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

          const isRevealed = activeTab === "friends";
          const online = isRevealed && onlineUsers.includes(friend.username);

          return (
            <article
              key={friend.id}
              className="grid min-h-16 grid-cols-[minmax(220px,1fr)_110px_100px_80px_80px_92px_170px] items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 last:border-b-0 hover:bg-white/[0.045]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <AvatarToken image={friend.avatarUrl} name={friend.displayName} online={online} />

                <UserName user={friend} />
              </div>

              <span className="font-black text-[var(--brass)] tabular-nums">
                {friend.stats?.rating ?? 0}
              </span>

              <span className="font-black text-[var(--mint)] tabular-nums">{winRate}%</span>

              <span className="font-black text-[var(--muted-strong)] tabular-nums">{wins}</span>

              <span className="font-black text-[var(--muted-text)] tabular-nums">{losses}</span>

              <Badge tone={online ? "mint" : "neutral"}>{online ? "Online" : "Offline"}</Badge>

              <div className="flex items-center gap-2">
                {activeTab === "friends" ? (
                  <>
                    <Link
                      href={`/messages?user=${friend.username}`}
                      className="icon-button"
                      aria-label={`Message ${friend.displayName}`}
                    >
                      <MessageSquare aria-hidden="true" className="size-4" />
                    </Link>

                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Challenge ${friend.displayName}`}
                    >
                      <Swords aria-hidden="true" className="size-4 text-[var(--brass)]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemove(friend.id)}
                      className="icon-button"
                      aria-label={`Remove ${friend.displayName}`}
                    >
                      <UserMinus aria-hidden="true" className="size-4 text-[var(--danger)]" />
                    </button>
                  </>
                ) : activeTab === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onRespond(friend.id, true)}
                      className="icon-button"
                      aria-label={`Accept ${friend.displayName}`}
                    >
                      <Check aria-hidden="true" className="size-4 text-[var(--mint)]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRespond(friend.id, false)}
                      className="icon-button"
                      aria-label={`Decline ${friend.displayName}`}
                    >
                      <X aria-hidden="true" className="size-4 text-[var(--danger)]" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRespond(friend.id, false)}
                    className="icon-button"
                    aria-label={`Cancel request to ${friend.displayName}`}
                  >
                    <X aria-hidden="true" className="size-4 text-[var(--danger)]" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function UserName({
  user,
}: {
  user: Pick<FriendData, "username" | "displayName" | "avatarUrl"> | SearchUser;
}) {
  return (
    <span className="min-w-0">
      <Link
        href={`/profile/${user.username}`}
        className="block truncate font-black text-[var(--text)] no-underline"
      >
        {user.displayName}
      </Link>

      <span className="block truncate text-xs text-[var(--muted-text)]">@{user.username}</span>
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-md border border-dashed border-[var(--panel-border)] bg-white/[0.035] p-8 text-center">
      <div>
        <Users aria-hidden="true" className="mx-auto mb-4 size-10 text-[var(--brass)]" />

        <p className="m-0 font-serif text-2xl font-bold">{label}</p>
      </div>
    </div>
  );
}
