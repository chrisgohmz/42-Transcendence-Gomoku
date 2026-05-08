"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, MessageSquare, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Form from "next/form";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  sentRequests,
  searchQuery,
  searchResults,
}: FriendsContentProps) {
  const { onlineUsers, socket } = usePresence();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("friends");
  const [activeTab, setActiveTab] = useState<TabKey>("friends");
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(
    null,
  );

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
    const timer = setTimeout(() => setStatusMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const handleSendRequest = async (targetUsername: string) => {
    setStatusMessage(null);
    const result = await sendFriendRequest(targetUsername);
    if (result?.error) {
      setStatusMessage({ text: result.error, isError: true });
      return;
    }

    setStatusMessage({
      text: t("messages.requestSent", { name: targetUsername }),
      isError: false,
    });
    socket?.emit("friendship:notify", targetUsername);
    router.replace(pathname, { scroll: false });
  };

  const handleRespond = async (friendshipId: number, accept: boolean) => {
    const request =
      pendingRequests.find((item) => item.id === friendshipId) ||
      sentRequests.find((item) => item.id === friendshipId);
    await respondToRequest(friendshipId, accept);
    if (request) socket?.emit("friendship:notify", request.username);
    router.refresh();
  };

  const handleRemove = async (friendshipId: number) => {
    if (!window.confirm("Are you sure you want to remove this friend?")) return;
    const friend = friends.find((item) => item.id === friendshipId);
    await removeFriend(friendshipId);
    if (friend) socket?.emit("friendship:notify", friend.username);
    router.refresh();
  };

  const tabs = [
    { key: "friends", label: t("tabs.friends"), count: friends.length },
    { key: "pending", label: t("tabs.pending"), count: pendingRequests.length },
    { key: "sent", label: t("tabs.sent"), count: sentRequests.length },
  ] as const;

  return (
    <main className="app-shell app-shell-wide">
      <section className="command-panel mb-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_minmax(340px,0.48fr)] lg:items-end">
          <div>
            <p className="eyebrow">Social Table</p>
            <h1 className="page-title">{t("title")}</h1>
            <p className="lede">
              Track rivals, answer requests, and jump from a profile to a rematch without leaving
              the board-room flow.
            </p>
          </div>

          <Form action="" scroll={false} className="grid gap-3">
            <label htmlFor="friend-search" className="field-label">
              {t("search")}
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="field-shell">
                <Search aria-hidden="true" className="size-4 text-[var(--brass)]" />
                <input
                  id="friend-search"
                  key={searchQuery}
                  name="query"
                  type="text"
                  defaultValue={searchQuery}
                  placeholder={t("searchPlaceholder")}
                  autoComplete="off"
                  className="text-input field-input"
                />
              </div>
              <button type="submit" className="btn m-0 px-5">
                {t("search")}
              </button>
            </div>
          </Form>
        </div>

        {statusMessage ? (
          <p
            className={`mt-4 text-sm font-bold ${statusMessage.isError ? "text-[var(--danger)]" : "text-[var(--mint)]"}`}
            role={statusMessage.isError ? "alert" : "status"}
            aria-live="polite"
          >
            {statusMessage.text}
          </p>
        ) : null}
      </section>

      {searchQuery.length > 0 ? (
        <section className="surface-panel mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold">Search Results</h2>
            <span className="text-sm font-bold text-[var(--muted-text)] tabular-nums">
              {searchResults.length}
            </span>
          </div>
          {searchResults.length === 0 ? (
            <p className="m-0 text-sm font-bold text-[var(--danger)]">{t("empty.search")}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((user) => (
                <article key={user.id} className="kpi-card flex items-center justify-between gap-3">
                  <UserIdentity user={user} />
                  <button
                    type="button"
                    onClick={() => handleSendRequest(user.username)}
                    className="btn btn-subtle m-0 min-h-0 px-3 py-2 text-xs"
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    {t("actions.add")}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="command-panel content-start">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)]">
              <Users aria-hidden="true" className="size-5 text-[var(--mint)]" />
            </span>
            <div>
              <p className="label m-0">Roster</p>
              <h2 className="font-serif text-2xl font-bold">Connections</h2>
            </div>
          </div>
          <div className="grid gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`sidebar-link w-full justify-between ${
                  activeTab === tab.key
                    ? "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]"
                    : ""
                }`}
              >
                <span>{tab.label}</span>
                <span className="tabular-nums">{tab.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="surface-panel">
          {activeTab === "friends" ? (
            <FriendGrid
              emptyLabel={t("empty.friends")}
              friends={friends}
              onlineUsers={onlineUsers}
              onRemove={handleRemove}
              chatLabel={t("actions.chat")}
              removeLabel={t("actions.remove")}
            />
          ) : null}

          {activeTab === "pending" ? (
            <RequestGrid
              emptyLabel={t("empty.pending")}
              requests={pendingRequests}
              primaryLabel={t("actions.accept")}
              secondaryLabel={t("actions.decline")}
              onPrimary={(id) => handleRespond(id, true)}
              onSecondary={(id) => handleRespond(id, false)}
            />
          ) : null}

          {activeTab === "sent" ? (
            <RequestGrid
              emptyLabel={t("empty.sent")}
              requests={sentRequests}
              primaryLabel={t("actions.cancelRequest")}
              onPrimary={(id) => handleRespond(id, false)}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function FriendGrid({
  emptyLabel,
  friends,
  onlineUsers,
  onRemove,
  chatLabel,
  removeLabel,
}: {
  emptyLabel: string;
  friends: FriendData[];
  onlineUsers: string[];
  onRemove: (id: number) => void;
  chatLabel: string;
  removeLabel: string;
}) {
  if (friends.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {friends.map((friend) => {
        const wins = friend.stats?.wins ?? 0;
        const played = friend.stats?.matchesPlayed ?? 0;
        const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

        return (
          <article key={friend.id} className="command-panel shadow-none">
            <div className="flex items-start justify-between gap-3">
              <UserIdentity user={friend} online={onlineUsers.includes(friend.username)} />
              <span className="rounded-md border border-[var(--brass)]/35 bg-[var(--brass-soft)] px-2 py-1 text-xs font-black text-[var(--brass)] tabular-nums">
                {friend.stats?.rating ?? 0}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniStat label="WR" value={`${winRate}%`} />
              <MiniStat label="W" value={wins} />
              <MiniStat label="L" value={friend.stats?.losses ?? 0} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/messages?user=${friend.username}`}
                className="btn btn-subtle m-0 min-h-0 px-3 py-2"
              >
                <MessageSquare aria-hidden="true" className="size-4" />
                {chatLabel}
              </Link>
              <button
                type="button"
                onClick={() => onRemove(friend.id)}
                className="btn btn-danger m-0 min-h-0 px-3 py-2"
              >
                <UserMinus aria-hidden="true" className="size-4" />
                {removeLabel}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RequestGrid({
  emptyLabel,
  requests,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  emptyLabel: string;
  requests: FriendData[];
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: (id: number) => void;
  onSecondary?: (id: number) => void;
}) {
  if (requests.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {requests.map((request) => (
        <article key={request.id} className="kpi-card">
          <UserIdentity user={request} />
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPrimary(request.id)}
              className="btn m-0 min-h-0 px-3 py-2"
            >
              <Check aria-hidden="true" className="size-4" />
              {primaryLabel}
            </button>
            {secondaryLabel && onSecondary ? (
              <button
                type="button"
                onClick={() => onSecondary(request.id)}
                className="btn btn-danger m-0 min-h-0 px-3 py-2"
              >
                <X aria-hidden="true" className="size-4" />
                {secondaryLabel}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function UserIdentity({
  user,
  online,
}: {
  user: Pick<FriendData, "username" | "displayName" | "avatarUrl">;
  online?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link href={`/profile/${user.username}`} className="shrink-0">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            width={44}
            height={44}
            loading="lazy"
            className="size-11 rounded-full border border-[var(--panel-border-soft)] object-cover"
          />
        ) : (
          <span className="grid size-11 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.08] font-black uppercase">
            {user.displayName.charAt(0)}
          </span>
        )}
      </Link>
      <div className="min-w-0">
        <Link
          href={`/profile/${user.username}`}
          className="block truncate font-black text-[var(--text)] no-underline"
        >
          {user.displayName}
        </Link>
        <p className="m-0 flex items-center gap-2 text-xs text-[var(--muted-text)]">
          <span
            className={`size-2 rounded-full ${online ? "bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]" : "bg-[var(--danger)]/75"}`}
          />
          @{user.username}
        </p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3">
      <div className="text-lg font-black tabular-nums">{value}</div>
      <p className="m-0 text-xs font-bold text-[var(--muted-text)]">{label}</p>
    </div>
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
