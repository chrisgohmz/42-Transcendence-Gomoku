"use client";

import { MessageSquare, UserMinus, Check, X, Users, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { usePresence } from "@/components/presence-provider";
import { removeFriend, respondToRequest, sendFriendRequest, searchUsers } from "./actions";

type FriendData = {
  id: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stats: any;
};

type FriendsContentProps = {
  friends: FriendData[];
  pendingRequests: FriendData[];
  sentRequests: FriendData[];
};

export default function FriendsContent({
    friends,
    pendingRequests,
    sentRequests,
  }: FriendsContentProps) {
    const { onlineUsers, socket } = usePresence();
    const router = useRouter();
    const t = useTranslations("friends");

    const [activeTab, setActiveTab] = useState("friends");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setStatusMessage(null);
    setSearchResults([]);
    const result = await searchUsers(searchQuery.trim());
    if (result.error) {
      setStatusMessage({ text: result.error, isError: true });
    } else if (result.users?.length === 0) {
      setStatusMessage({ text: t("empty.search"), isError: true });
    } else {
      setSearchResults(result.users || []);
    }
  };

  const handleSendRequest = async (targetUsername: string) => {
    setStatusMessage(null);
    const result = await sendFriendRequest(targetUsername);
    if (result?.error) {
      setStatusMessage({ text: result.error, isError: true });
    } else {
      setStatusMessage({ text: t("messages.requestSent", { name: targetUsername }), isError: false });
      setSearchResults([]);
      setSearchQuery("");
      socket?.emit("friendship:notify", targetUsername);
    }
  };

  const handleRespond = async (friendshipId: number, accept: boolean) => {
    const request = pendingRequests.find((r) => r.id === friendshipId) || sentRequests.find((r) => r.id === friendshipId);
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
    <main className="shell">
      <section className="mt-4 mb-12 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <Users className="h-12 w-12 text-[#4ee8c2]" />
          <h1 className="m-0 text-5xl font-bold">{t("title")}</h1>
        </div>
        <div className="flex w-full max-w-md gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="flex-1 rounded-xl border border-slate-700/50 bg-[#0c1628] px-5 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="rounded-xl bg-[#4ee8c2] px-6 py-3 font-bold tracking-wider text-[#04131a] uppercase transition-transform hover:-translate-y-0.5"
          >
            {t("search")}
          </button>
        </div>

        {/* Dropdown for search results */}
        {searchResults.length > 0 && (
          <div className="mt-4 w-full max-w-md rounded-xl border border-slate-700/50 bg-[#08101F] p-2 shadow-lg shadow-blue-500/10">
            {searchResults.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${user.username}`}>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 font-bold uppercase text-white transition-transform hover:scale-105">
                        {user.displayName.charAt(0)}
                      </div>
                    )}
                  </Link>
                  <div className="text-left">
                    <Link href={`/profile/${user.username}`} className="block font-bold text-white transition-colors hover:text-[#4ee8c2]">
                      {user.displayName}
                    </Link>
                    <span className="block text-xs text-slate-400">@{user.username}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleSendRequest(user.username)}
                  className="flex items-center gap-2 rounded-md bg-[#4ee8c2]/10 px-3 py-1.5 text-sm font-bold text-[#4ee8c2] transition-colors hover:bg-[#4ee8c2]/20"
                >
                  <UserPlus className="h-4 w-4" />
                  {t("actions.add")}
                </button>
              </div>
            ))}
          </div>
        )}

        {statusMessage && (
          <p className={`mt-3 text-sm font-bold ${statusMessage.isError ? "text-red-400" : "text-[#4ee8c2]"}`}>
            {statusMessage.text}
          </p>
        )}
      </section>

      <section className="panel">
        <div className="mb-8 flex justify-center gap-4 border-b border-slate-700/50 pb-4">
          <button
            onClick={() => setActiveTab("friends")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "friends" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {t("tabs.friends")} ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "pending" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {t("tabs.pending")} ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "sent" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {t("tabs.sent")} ({sentRequests.length})
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {activeTab === "friends" && (
            <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-[#08101F] shadow-lg shadow-blue-500/10">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    <th className="p-4 font-bold text-slate-200">{t("table.rank")}</th>
                    <th className="p-4 font-bold text-slate-200">{t("table.friend")}</th>
                    <th className="p-4 font-bold text-slate-200">{t("table.rating")}</th>
                    <th className="p-4 font-bold text-slate-200">{t("table.winRate")}</th>
                    <th className="p-4 font-bold text-slate-200">{t("table.wins")}</th>
                    <th className="p-4 font-bold text-slate-200">{t("table.losses")}</th>
                    <th className="p-4 text-right font-bold text-slate-200">
                      {t("table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {friends.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">{t("empty.friends")}</td>
                    </tr>
                  ) : (
                    friends.map((friend, index) => {
                      const wins = friend.stats?.wins || 0;
                      const played = friend.stats?.matchesPlayed || 0;
                      const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

                      return (
                        <tr key={friend.id} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/20">
                          <td className="p-4 text-slate-300">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Link href={`/profile/${friend.username}`}>
                                {friend.avatarUrl ? (
                                  <img src={friend.avatarUrl} alt={friend.displayName} className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105" />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 font-bold text-white uppercase transition-transform hover:scale-105">
                                    {friend.displayName.charAt(0)}
                                  </div>
                                )}
                              </Link>
                              <div className="flex flex-col text-left">
                                <Link href={`/profile/${friend.username}`} className="font-bold text-white transition-colors hover:text-[#4ee8c2]">
                                  {friend.displayName}
                                </Link>
                                {onlineUsers.includes(friend.username) ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-[#4ee8c2] shadow-[0_0_5px_#4ee8c2]"></span>
                                    <span className="text-xs font-bold text-[#4ee8c2]">{t("status.online")}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]"></span>
                                    <span className="text-xs font-bold text-red-500">{t("status.offline")}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300">{friend.stats?.rating || 0}</td>
                          <td className="p-4 text-slate-300">{winRate}%</td>
                          <td className="p-4 text-slate-300">{wins}</td>
                          <td className="p-4 text-slate-300">{friend.stats?.losses || 0}</td>
                          <td className="flex justify-end gap-2 p-4">
                              <Link
                              href="/messages"
                              className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-bold transition-colors hover:bg-slate-700"
                            >
                              <MessageSquare className="h-4 w-4" />
                              {t("actions.chat")}
                            </Link>
                            <button
                              onClick={() => handleRemove(friend.id)}
                              className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20"
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
            <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-[#08101F] shadow-lg shadow-blue-500/10">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    <th className="p-4 font-bold text-slate-200">{t("tabs.pending")}</th>
                    <th className="p-4 text-right font-bold text-slate-200">
                      {t("table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-slate-400">{t("empty.pending")}</td>
                    </tr>
                  ) : (
                    pendingRequests.map((request) => (
                        <tr key={request.id} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/20">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Link href={`/profile/${request.username}`}>
                              {request.avatarUrl ? (
                                <img src={request.avatarUrl} alt={request.displayName} className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 font-bold uppercase text-white transition-transform hover:scale-105">
                                  {request.displayName.charAt(0)}
                                </div>
                              )}
                            </Link>
                            <Link href={`/profile/${request.username}`} className="font-bold text-white transition-colors hover:text-[#4ee8c2]">
                              {request.displayName}
                            </Link>
                          </div>
                        </td>
                        <td className="flex justify-end gap-2 p-4">
                          <button
                            onClick={() => handleRespond(request.id, true)}
                            className="flex items-center gap-2 rounded-md bg-[#4ee8c2]/10 px-3 py-1.5 text-sm font-bold text-[#4ee8c2] transition-colors hover:bg-[#4ee8c2]/20"
                          >
                            <Check className="h-4 w-4" />
                            {t("actions.accept")}
                          </button>
                          <button
                            onClick={() => handleRespond(request.id, false)}
                            className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20"
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
            <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-[#08101F] shadow-lg shadow-blue-500/10">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    <th className="p-4 font-bold text-slate-200">{t("tabs.sent")}</th>
                    <th className="p-4 text-right font-bold text-slate-200">
                      {t("table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sentRequests.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-slate-400">{t("empty.sent")}</td>
                    </tr>
                  ) : (
                    sentRequests.map((request) => (
                        <tr key={request.id} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/20">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Link href={`/profile/${request.username}`}>
                              {request.avatarUrl ? (
                                <img src={request.avatarUrl} alt={request.displayName} className="h-8 w-8 rounded-full object-cover transition-transform hover:scale-105" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 font-bold uppercase text-white transition-transform hover:scale-105">
                                  {request.displayName.charAt(0)}
                                </div>
                              )}
                            </Link>
                            <Link href={`/profile/${request.username}`} className="font-bold text-white transition-colors hover:text-[#4ee8c2]">
                              {request.displayName}
                            </Link>
                          </div>
                        </td>
                        <td className="flex justify-end p-4">
                          <button
                            onClick={() => handleRespond(request.id, false)}
                            className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-700"
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
