"use client";

/* eslint-disable @next/next/no-img-element */
import { MessageSquare, UserMinus, Check, X, Users, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import Form from "next/form";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { usePresence } from "@/components/presence-provider";
import { Link } from "@/i18n/navigation";

import { removeFriend, respondToRequest, sendFriendRequest } from "./actions";

type FriendData = {
  id: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stats: any;
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
  const [activeTab, setActiveTab] = useState("friends");
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
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleSendRequest = async (targetUsername: string) => {
    setStatusMessage(null);
    const result = await sendFriendRequest(targetUsername);
    if (result?.error) {
      setStatusMessage({ text: result.error, isError: true });
    } else {
      setStatusMessage({
        text: t("messages.requestSent", { name: targetUsername }),
        isError: false,
      });
      socket?.emit("friendship:notify", targetUsername);
      router.replace(pathname, { scroll: false });
    }
  };

  const handleRespond = async (friendshipId: number, accept: boolean) => {
    const request =
      pendingRequests.find((r) => r.id === friendshipId) ||
      sentRequests.find((r) => r.id === friendshipId);
    await respondToRequest(friendshipId, accept);
    if (request) socket?.emit("friendship:notify", request.username);
    router.refresh();
  };

  const handleRemove = async (friendshipId: number) => {
    if (window.confirm("Are you sure you want to remove this friend?")) {
      const friend = friends.find((f) => f.id === friendshipId);
      await removeFriend(friendshipId);
      if (friend) socket?.emit("friendship:notify", friend.username);
      router.refresh();
    }
  };

  return (
    <main className="app-shell app-shell-wide">
      <section className="mt-4 mb-12 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <Users aria-hidden="true" className="h-12 w-12 text-[var(--brass)]" />
          <h1 className="page-title">{t("title")}</h1>
        </div>
        <Form action="" scroll={false} className="flex w-full max-w-md gap-3">
          <input
            key={searchQuery}
            name="query"
            type="text"
            defaultValue={searchQuery}
            aria-label={t("search")}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className="text-input flex-1"
          />
          <button type="submit" className="btn m-0 px-6 py-3">
            {t("search")}
          </button>
        </Form>

        {searchResults.length > 0 && (
          <div className="mt-4 w-full max-w-md rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e] p-2 shadow-lg">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${user.username}`}>
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        width={32}
                        height={32}
                        loading="lazy"
                        className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] font-bold text-white uppercase transition-transform hover:scale-105">
                        {user.displayName.charAt(0)}
                      </div>
                    )}
                  </Link>
                  <div className="text-left">
                    <Link
                      href={`/profile/${user.username}`}
                      className="block font-bold text-white transition-colors hover:text-[var(--mint)]"
                    >
                      {user.displayName}
                    </Link>
                    <span className="block text-xs text-[var(--muted-text)]">@{user.username}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendRequest(user.username)}
                  className="flex items-center gap-2 rounded-md bg-[var(--mint-soft)] px-3 py-1.5 text-sm font-bold text-[var(--mint)] transition-colors hover:bg-[rgb(121_220_138_/_0.2)] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none"
                >
                  <UserPlus aria-hidden="true" className="h-4 w-4" />
                  {t("actions.add")}
                </button>
              </div>
            ))}
          </div>
        )}

        {!statusMessage && searchQuery.length > 0 && searchResults.length === 0 && (
          <p className="mt-3 text-sm font-bold text-[var(--danger)]">{t("empty.search")}</p>
        )}

        {statusMessage && (
          <p
            className={`mt-3 text-sm font-bold ${statusMessage.isError ? "text-[var(--danger)]" : "text-[var(--mint)]"}`}
          >
            {statusMessage.text}
          </p>
        )}
      </section>

      <section className="panel">
        <div className="mb-8 flex flex-wrap justify-center gap-3 border-b border-[var(--panel-border-soft)] pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("friends")}
            className={`rounded-md px-4 py-2 font-bold transition-colors focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${activeTab === "friends" ? "bg-[var(--mint)] text-[var(--primary-foreground)]" : "text-[var(--muted-text)] hover:bg-white/[0.06]"}`}
          >
            {t("tabs.friends")} ({friends.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`rounded-md px-4 py-2 font-bold transition-colors focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${activeTab === "pending" ? "bg-[var(--mint)] text-[var(--primary-foreground)]" : "text-[var(--muted-text)] hover:bg-white/[0.06]"}`}
          >
            {t("tabs.pending")} ({pendingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sent")}
            className={`rounded-md px-4 py-2 font-bold transition-colors focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${activeTab === "sent" ? "bg-[var(--mint)] text-[var(--primary-foreground)]" : "text-[var(--muted-text)] hover:bg-white/[0.06]"}`}
          >
            {t("tabs.sent")} ({sentRequests.length})
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {activeTab === "friends" && (
            <div className="overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e] shadow-lg">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--panel-border-soft)] bg-white/[0.04]">
                    <th className="p-4 font-bold text-[var(--muted-strong)]">{t("table.rank")}</th>
                    <th className="p-4 font-bold text-[var(--muted-strong)]">
                      {t("table.friend")}
                    </th>
                    <th className="p-4 font-bold text-[var(--muted-strong)]">
                      {t("table.rating")}
                    </th>
                    <th className="p-4 font-bold text-[var(--muted-strong)]">
                      {t("table.winRate")}
                    </th>
                    <th className="p-4 font-bold text-[var(--muted-strong)]">{t("table.wins")}</th>
                    <th className="p-4 font-bold text-[var(--muted-strong)]">
                      {t("table.losses")}
                    </th>
                    <th className="p-4 text-right font-bold text-[var(--muted-strong)]">
                      {t("table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {friends.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[var(--muted-text)]">
                        {t("empty.friends")}
                      </td>
                    </tr>
                  ) : (
                    friends.map((friend, index) => {
                      const wins = friend.stats?.wins || 0;
                      const played = friend.stats?.matchesPlayed || 0;
                      const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

                      return (
                        <tr
                          key={friend.id}
                          className="border-b border-[var(--panel-border-soft)] transition-colors hover:bg-white/[0.05]"
                        >
                          <td className="p-4 text-[var(--muted-text)]">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Link href={`/profile/${friend.username}`}>
                                {friend.avatarUrl ? (
                                  <img
                                    src={friend.avatarUrl}
                                    alt={friend.displayName}
                                    width={32}
                                    height={32}
                                    loading="lazy"
                                    className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] font-bold text-white uppercase transition-transform hover:scale-105">
                                    {friend.displayName.charAt(0)}
                                  </div>
                                )}
                              </Link>
                              <div className="flex flex-col text-left">
                                <Link
                                  href={`/profile/${friend.username}`}
                                  className="font-bold text-white transition-colors hover:text-[var(--mint)]"
                                >
                                  {friend.displayName}
                                </Link>
                                {onlineUsers.includes(friend.username) ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]"></span>
                                    <span className="text-xs font-bold text-[var(--mint)]">
                                      {t("status.online")}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-[var(--danger)] shadow-[0_0_10px_var(--danger)]"></span>
                                    <span className="text-xs font-bold text-[var(--danger)]">
                                      {t("status.offline")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-[var(--muted-text)]">
                            {friend.stats?.rating || 0}
                          </td>
                          <td className="p-4 text-[var(--muted-text)]">{winRate}%</td>
                          <td className="p-4 text-[var(--muted-text)]">{wins}</td>
                          <td className="p-4 text-[var(--muted-text)]">
                            {friend.stats?.losses || 0}
                          </td>
                          <td className="flex justify-end gap-2 p-4">
                            <Link
                              href={`/messages?user=${friend.username}`}
                              className="flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-1.5 text-sm font-bold transition-colors hover:bg-white/[0.1]"
                            >
                              <MessageSquare className="h-4 w-4" />
                              {t("actions.chat")}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemove(friend.id)}
                              className="flex items-center gap-2 rounded-md bg-[rgb(198_56_47_/_0.15)] px-3 py-1.5 text-sm font-bold text-[var(--danger)] transition-colors hover:bg-[rgb(198_56_47_/_0.25)]"
                            >
                              <UserMinus className="h-4 w-4" />
                              {t("actions.remove")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "pending" && (
            <div className="overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e] shadow-lg">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--panel-border-soft)] bg-white/[0.04]">
                    <th className="p-4 font-bold text-[var(--muted-strong)]">
                      {t("tabs.pending")}
                    </th>
                    <th className="p-4 text-right font-bold text-[var(--muted-strong)]">
                      {t("table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-[var(--muted-text)]">
                        {t("empty.pending")}
                      </td>
                    </tr>
                  ) : (
                    pendingRequests.map((request) => (
                      <tr
                        key={request.id}
                        className="border-b border-[var(--panel-border-soft)] transition-colors hover:bg-white/[0.05]"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Link href={`/profile/${request.username}`}>
                              {request.avatarUrl ? (
                                <img
                                  src={request.avatarUrl}
                                  alt={request.displayName}
                                  width={32}
                                  height={32}
                                  loading="lazy"
                                  className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] font-bold text-white uppercase transition-transform hover:scale-105">
                                  {request.displayName.charAt(0)}
                                </div>
                              )}
                            </Link>
                            <Link
                              href={`/profile/${request.username}`}
                              className="font-bold text-white transition-colors hover:text-[var(--mint)]"
                            >
                              {request.displayName}
                            </Link>
                          </div>
                        </td>
                        <td className="flex justify-end gap-2 p-4">
                          <button
                            type="button"
                            onClick={() => handleRespond(request.id, true)}
                            className="flex items-center gap-2 rounded-md bg-[rgb(121_220_138_/_0.1)] px-3 py-1.5 text-sm font-bold text-[var(--mint)] transition-colors hover:bg-[rgb(121_220_138_/_0.2)]"
                          >
                            <Check className="h-4 w-4" />
                            {t("actions.accept")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespond(request.id, false)}
                            className="flex items-center gap-2 rounded-md bg-[rgb(198_56_47_/_0.15)] px-3 py-1.5 text-sm font-bold text-[var(--danger)] transition-colors hover:bg-[rgb(198_56_47_/_0.25)]"
                          >
                            <X className="h-4 w-4" />
                            {t("actions.decline")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "sent" && (
            <div className="overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e] shadow-lg">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--panel-border-soft)] bg-white/[0.04]">
                    <th className="p-4 font-bold text-[var(--muted-strong)]">{t("tabs.sent")}</th>
                    <th className="p-4 text-right font-bold text-[var(--muted-strong)]">
                      {t("table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sentRequests.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-[var(--muted-text)]">
                        {t("empty.sent")}
                      </td>
                    </tr>
                  ) : (
                    sentRequests.map((request) => (
                      <tr
                        key={request.id}
                        className="border-b border-[var(--panel-border-soft)] transition-colors hover:bg-white/[0.05]"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Link href={`/profile/${request.username}`}>
                              {request.avatarUrl ? (
                                <img
                                  src={request.avatarUrl}
                                  alt={request.displayName}
                                  width={32}
                                  height={32}
                                  loading="lazy"
                                  className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] font-bold text-white uppercase transition-transform hover:scale-105">
                                  {request.displayName.charAt(0)}
                                </div>
                              )}
                            </Link>
                            <Link
                              href={`/profile/${request.username}`}
                              className="font-bold text-white transition-colors hover:text-[var(--mint)]"
                            >
                              {request.displayName}
                            </Link>
                          </div>
                        </td>
                        <td className="flex justify-end p-4">
                          <button
                            type="button"
                            onClick={() => handleRespond(request.id, false)}
                            className="flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-1.5 text-sm font-bold text-[var(--muted-text)] transition-colors hover:bg-white/[0.1]"
                          >
                            <X className="h-4 w-4" />
                            {t("actions.cancelRequest")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
