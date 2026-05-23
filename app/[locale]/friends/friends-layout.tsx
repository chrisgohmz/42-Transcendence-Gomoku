"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Search,
  Swords,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Form from "next/form";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvatarToken, Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { usePresence } from "@/components/presence-provider";
import { useChallengePlayer } from "@/hooks/useChallengePlayer";
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

const FRIENDS_PAGE_SIZE = 10;

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
  const { challengePlayer, challengingUsername } = useChallengePlayer();

  const [activeTab, setActiveTab] = useState<TabKey>("friends");
  const [rosterPage, setRosterPage] = useState(1);

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<FriendData | null>(null);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);

  const [searchValue, setSearchValue] = useState(searchQuery);

  const rosterTitle =
    activeTab === "friends"
      ? t("roster.titles.friends")
      : activeTab === "pending"
        ? t("roster.titles.pending")
        : t("roster.titles.sent");

  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => {
      router.refresh();
    };

    socket.on("friendship:refresh", handleRefresh);

    return () => {
      socket.off("friendship:refresh", handleRefresh);
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

    if (accept && request) {
      socket?.emit("friendship:notify", request.username);
    }

    router.refresh();
  };

  const handleRemove = async () => {
    if (!friendToRemove) return;

    setIsRemovingFriend(true);

    try {
      await removeFriend(friendToRemove.id);
      setFriendToRemove(null);
      router.refresh();
    } finally {
      setIsRemovingFriend(false);
    }
  };

  const handleChallenge = async (username: string) => {
    setStatusMessage(null);

    const didSend = await challengePlayer(username);

    if (!didSend) {
      setStatusMessage({
        text: "Could not send the challenge. Make sure realtime is connected and try again.",
        isError: true,
      });
    }
  };

  const activeRows =
    activeTab === "friends" ? friends : activeTab === "pending" ? pendingRequests : sentRequests;
  const rosterTotalPages = Math.max(1, Math.ceil(activeRows.length / FRIENDS_PAGE_SIZE));
  const currentRosterPage = Math.min(rosterPage, rosterTotalPages);
  const paginatedRows = activeRows.slice(
    (currentRosterPage - 1) * FRIENDS_PAGE_SIZE,
    currentRosterPage * FRIENDS_PAGE_SIZE,
  );

  useEffect(() => {
    setRosterPage((currentPage) => Math.min(currentPage, rosterTotalPages));
  }, [rosterTotalPages]);

  return (
    <PageShell>
      <PageHeader
        eyebrow={t("pageHeader.eyebrow")}
        icon={Users}
        title={t("title")}
        lede={t("pageHeader.lede")}
      />

      {statusMessage ? (
        <p
          className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${
            statusMessage.isError
              ? "border-(--danger)/35 bg-[rgb(216_60_52/0.16)] text-(--danger)"
              : "border-(--mint)/35 bg-(--mint-soft) text-(--mint)"
          }`}
          role={statusMessage.isError ? "alert" : "status"}
          aria-live="polite"
        >
          {statusMessage.text}
        </p>
      ) : null}

      <section className="grid gap-5">
        <Surface eyebrow={t("roster.eyebrow")} title={rosterTitle}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex overflow-hidden rounded-md border border-(--panel-border-soft) bg-(--panel-solid) p-1">
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
                  onClick={() => {
                    setActiveTab(tab.key as TabKey);
                    setRosterPage(1);
                  }}
                  className={`min-h-10 rounded-sm px-4 text-sm font-black ${
                    activeTab === tab.key ? "bg-(--mint-soft) text-(--mint)" : "text-(--muted-text)"
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
                  <Search className="size-4 text-(--muted-text)" />
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
                <div className="absolute top-full left-0 z-50 mt-2 w-full rounded-md border border-(--panel-border) bg-(--panel-solid) p-2 shadow-xl">
                  {searchResults.length === 0 ? (
                    <p className="p-2 text-sm font-bold text-(--danger)">{t("empty.search")}</p>
                  ) : (
                    <div className="grid gap-1">
                      {searchResults.map((user) => (
                        <article
                          key={user.id}
                          className="flex items-center gap-3 rounded-sm p-2 hover:bg-white/5"
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
            <div className="grid gap-4">
              <FriendsTable
                activeTab={activeTab}
                friends={paginatedRows}
                challengingUsername={challengingUsername}
                onlineUsers={onlineUsers}
                onChallenge={handleChallenge}
                onRemove={setFriendToRemove}
                onRespond={handleRespond}
              />

              {rosterTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--panel-border-soft) pt-4 text-sm">
                  <span className="font-bold text-(--muted-text)">
                    {t("pagination.status", {
                      page: currentRosterPage,
                      totalPages: rosterTotalPages,
                    })}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRosterPage((page) => Math.max(1, page - 1))}
                      disabled={currentRosterPage <= 1}
                      className="btn btn-subtle m-0 h-9 px-3 text-xs disabled:opacity-50"
                    >
                      <ChevronLeft aria-hidden="true" className="size-4" />
                      {t("pagination.previous")}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRosterPage((page) => Math.min(rosterTotalPages, page + 1))}
                      disabled={currentRosterPage >= rosterTotalPages}
                      className="btn btn-subtle m-0 h-9 px-3 text-xs disabled:opacity-50"
                    >
                      {t("pagination.next")}
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Surface>
      </section>

      {friendToRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm overflow-hidden rounded-xl border border-(--panel-border-soft) bg-[#0e0e11] shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-(--panel-border-soft) bg-white/2 px-5 py-4">
              <h3 className="flex items-center gap-2 font-black text-white">
                <UserMinus aria-hidden="true" className="size-4 text-(--danger)" />
                {t("actions.removeFriend", { name: friendToRemove.displayName })}
              </h3>
              <button
                type="button"
                onClick={() => setFriendToRemove(null)}
                className="rounded-md text-(--muted-text) transition-colors hover:text-white"
                aria-label={t("actions.cancel")}
                disabled={isRemovingFriend}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="p-5">
              <p className="mb-6 text-sm leading-relaxed text-(--muted-text)">
                {t("actions.confirmRemoveFriend")}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFriendToRemove(null)}
                  className="rounded-md px-4 py-2 text-sm font-bold text-(--muted-text) transition-colors hover:bg-white/5 hover:text-white"
                  disabled={isRemovingFriend}
                >
                  {t("actions.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRemove();
                  }}
                  disabled={isRemovingFriend}
                  className="min-h-10 rounded-md border border-(--danger)/35 bg-(--danger)/10 px-5 text-sm font-black text-(--danger) transition-colors hover:bg-(--danger)/20 disabled:opacity-50"
                >
                  {t("actions.remove")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function FriendsTable({
  activeTab,
  challengingUsername,
  friends,
  onlineUsers,
  onChallenge,
  onRemove,
  onRespond,
}: {
  activeTab: TabKey;
  challengingUsername: string | null;
  friends: FriendData[];
  onlineUsers: string[];
  onChallenge: (username: string) => void;
  onRemove: (friend: FriendData) => void;
  onRespond: (id: number, accept: boolean) => void;
}) {
  const t = useTranslations("friends");

  return (
    <div
      className="overflow-x-auto rounded-md border border-(--panel-border-soft) bg-white/2.5"
      data-testid="friends-table"
    >
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[minmax(220px,1fr)_110px_100px_80px_80px_92px_170px] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
          <span>{t("table.friend")}</span>
          <span>{t("table.rating")}</span>
          <span>{t("table.winRate")}</span>
          <span>{t("table.wins")}</span>
          <span>{t("table.losses")}</span>
          <span>{t("table.status")}</span>
          <span>{t("table.actions")}</span>
        </div>

        {friends.map((friend) => {
          const wins = friend.stats?.wins ?? 0;
          const losses = friend.stats?.losses ?? 0;
          const played = friend.stats?.matchesPlayed ?? 0;

          const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

          const isRevealed = activeTab === "friends";
          const online = isRevealed && onlineUsers.includes(friend.username);
          const isChallenging = challengingUsername === friend.username;

          return (
            <article
              key={friend.id}
              className="grid min-h-16 grid-cols-[minmax(220px,1fr)_110px_100px_80px_80px_92px_170px] items-center gap-3 border-b border-(--panel-border-soft) px-4 py-3 last:border-b-0 hover:bg-white/4.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <AvatarToken image={friend.avatarUrl} name={friend.displayName} online={online} />

                <UserName user={friend} />
              </div>

              <span className="font-black text-(--brass) tabular-nums">
                {friend.stats?.rating ?? 0}
              </span>

              <span className="font-black text-(--mint) tabular-nums">{winRate}%</span>

              <span className="font-black text-(--muted-strong) tabular-nums">{wins}</span>

              <span className="font-black text-(--muted-text) tabular-nums">{losses}</span>

              <Badge tone={online ? "mint" : "neutral"}>
                {online ? t("status.online") : t("status.offline")}
              </Badge>

              <div className="flex items-center gap-2">
                {activeTab === "friends" ? (
                  <>
                    <Link
                      href={`/messages?friendId=${friend.userId}`}
                      className="icon-button"
                      aria-label={t("actions.messageFriend", { name: friend.displayName })}
                    >
                      <MessageSquare aria-hidden="true" className="size-4" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => onChallenge(friend.username)}
                      disabled={isChallenging}
                      className="icon-button disabled:opacity-50"
                      aria-label={t("actions.challengeFriend", { name: friend.displayName })}
                    >
                      {isChallenging ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin text-(--brass)"
                        />
                      ) : (
                        <Swords aria-hidden="true" className="size-4 text-(--brass)" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemove(friend)}
                      className="icon-button"
                      aria-label={t("actions.removeFriend", { name: friend.displayName })}
                    >
                      <UserMinus aria-hidden="true" className="size-4 text-(--danger)" />
                    </button>
                  </>
                ) : activeTab === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onRespond(friend.id, true)}
                      className="icon-button"
                      aria-label={t("actions.acceptFriend", { name: friend.displayName })}
                    >
                      <Check aria-hidden="true" className="size-4 text-(--mint)" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRespond(friend.id, false)}
                      className="icon-button"
                      aria-label={t("actions.declineFriend", { name: friend.displayName })}
                    >
                      <X aria-hidden="true" className="size-4 text-(--danger)" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRespond(friend.id, false)}
                    className="icon-button"
                    aria-label={t("actions.cancelFriendRequest", { name: friend.displayName })}
                  >
                    <X aria-hidden="true" className="size-4 text-(--danger)" />
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
        className="block truncate font-black text-(--text) no-underline"
      >
        {user.displayName}
      </Link>

      <span className="block truncate text-xs text-(--muted-text)">@{user.username}</span>
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-md border border-dashed border-(--panel-border) bg-white/3.5 p-8 text-center">
      <div>
        <Users aria-hidden="true" className="mx-auto mb-4 size-10 text-(--brass)" />

        <p className="m-0 font-serif text-2xl font-bold">{label}</p>
      </div>
    </div>
  );
}
