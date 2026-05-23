"use client";

import { MessageSquare, Search, Send, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AvatarToken, Badge, PageHeader, PageShell } from "@/components/gomoku-ui";
import { useChat } from "@/hooks/useChat";

// ── Types ─────────────────────────────────────────────────────────────────────

type Friend = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type Conversation = {
  id: string;
  otherUser: Friend | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

// A unified entry for the sidebar: every accepted friend appears here.
// conversationId is null for friends you haven't messaged yet.
type SidebarEntry = {
  friend: Friend;
  conversationId: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  // Passed from page.tsx (server component) — the logged-in user's ID.
  // We need this to tell which messages are "mine" vs "theirs".
  currentUserId: string;
};

export default function MessagesContent({ currentUserId }: Props) {
  const searchParams = useSearchParams();
  const t = useTranslations("messagesPage");

  // Raw data from the two API calls
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  // The currently open conversation
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  //const [activeFriend, setActiveFriend] = useState<Friend | null>(null);

  // Composer
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Search
  const [query, setQuery] = useState("");

  // Auto-scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // useChat loads history + manages the socket for the active conversation
  const { messages, sendMessage } = useChat(activeConvId);

  // ── Fetch conversations + friends ────────────────────────────────────────
  function loadSidebarData() {
    Promise.all([
      fetch("/api/conversations").then((r) => r.json()) as Promise<{
        conversations: Conversation[];
      }>,
      fetch("/api/friends").then((r) => r.json()) as Promise<{ friends: Friend[] }>,
    ])
      .then(([convData, friendData]) => {
        setConversations(convData.conversations ?? []);
        setFriends(friendData.friends ?? []);
      })
      .catch(console.error);
  }

  useEffect(() => {
    loadSidebarData();
  }, []);

  // ── Handle ?friendId= query param (link from the friends page) ───────────
  useEffect(() => {
    const friendId = searchParams.get("friendId");
    if (!friendId) return;

    fetch("/api/conversations/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId }),
    })
      .then((r) => r.json())
      .then(async (data: { conversationId: string }) => {
        setActiveConvId(data.conversationId);
        loadSidebarData();
      })
      .catch(console.error);
  }, [searchParams]);

  // ── Scroll to newest message ─────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Build the merged sidebar list ────────────────────────────────────────
  // Every accepted friend appears, whether or not they have an existing conversation.
  // Friends with conversations are sorted by recency; others appear at the bottom.
  const sidebarEntries = useMemo((): SidebarEntry[] => {
    const convByFriendId = new Map<string, Conversation>();
    for (const conv of conversations) {
      if (conv.otherUser) {
        convByFriendId.set(conv.otherUser.id, conv);
      }
    }

    const entries: SidebarEntry[] = friends.map((friend) => {
      const conv = convByFriendId.get(friend.id);
      return {
        friend,
        conversationId: conv?.id ?? null,
        lastMessage: conv?.lastMessage ?? null,
        lastMessageAt: conv?.lastMessageAt ?? null,
        unreadCount: conv?.unreadCount ?? 0,
      };
    });

    // Sort: most recently messaged first, then alphabetically
    return entries.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      }
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      const nameA = a.friend.displayName ?? a.friend.username;
      const nameB = b.friend.displayName ?? b.friend.username;
      return nameA.localeCompare(nameB);
    });
  }, [friends, conversations]);

  // calcate the active friend value based on the active conversation ID
  const activeFriend = useMemo(
    () => sidebarEntries.find((e) => e.conversationId === activeConvId)?.friend ?? null,
    [sidebarEntries, activeConvId],
  );

  // Filter by search query
  const visibleEntries = useMemo(
    () =>
      sidebarEntries.filter((entry) => {
        const name = entry.friend.displayName ?? entry.friend.username;
        return name.toLowerCase().includes(query.toLowerCase());
      }),
    [sidebarEntries, query],
  );

  // ── Click a sidebar entry ────────────────────────────────────────────────
  async function handleEntryClick(entry: SidebarEntry) {
    if (entry.conversationId) {
      // Conversation already exists — open it directly
      setActiveConvId(entry.conversationId);
      // Clear unread badge optimistically
      setConversations((prev) =>
        prev.map((c) => (c.id === entry.conversationId ? { ...c, unreadCount: 0 } : c)),
      );
    } else {
      // First time chatting — create the conversation on demand
      try {
        const res = await fetch("/api/conversations/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendId: entry.friend.id }),
        });
        const data = (await res.json()) as { conversationId: string };
        setActiveConvId(data.conversationId);
        loadSidebarData();
      } catch (err) {
        console.error("Failed to create conversation", err);
      }
    }
  }

  // ── Send a message ───────────────────────────────────────────────────────
  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageText.trim() || isSending || !activeConvId) return;

    setIsSending(true);
    const text = messageText;
    setMessageText("");

    try {
      await sendMessage(text);
      loadSidebarData();
    } catch {
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  }

  const activeName = activeFriend?.displayName ?? activeFriend?.username ?? "";

  return (
    <PageShell>
      <PageHeader eyebrow={t("eyebrow")} icon={MessageSquare} title={t("title")} lede={t("lede")} />

      <section className="grid min-h-[760px] overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel)] shadow-[0_30px_90px_rgba(0,0,0,0.4)] xl:grid-cols-[350px_minmax(0,1fr)]">
        {/* ── Sidebar ── */}
        <aside className="border-b border-[var(--panel-border-soft)] bg-[var(--sidebar)] p-4 xl:border-r xl:border-b-0">
          <label className="mb-4 grid gap-2">
            <span className="field-label">{t("search")}</span>
            <span className="field-shell">
              <Search aria-hidden="true" className="size-4 text-[var(--brass)]" />
              <input
                type="text"
                name="messageSearch"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="text-input field-input"
              />
            </span>
          </label>

          <div className="grid gap-2">
            {friends.length === 0 && (
              <p className="px-2 text-sm text-[var(--muted-text)]">{t("empty.noFriends")}</p>
            )}

            {visibleEntries.map((entry) => {
              const name = entry.friend.displayName ?? entry.friend.username;
              const isActive = entry.conversationId === activeConvId && activeConvId !== null;

              return (
                <button
                  key={entry.friend.id}
                  type="button"
                  onClick={() => void handleEntryClick(entry)}
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3 text-left transition-[background-color,border-color] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${
                    isActive
                      ? "border-[var(--mint)]/35 bg-[var(--mint-soft)]"
                      : "border-transparent bg-white/[0.035] hover:border-[var(--panel-border-soft)] hover:bg-white/[0.06]"
                  }`}
                >
                  <AvatarToken name={name} />
                  <span className="min-w-0">
                    <span className="block truncate font-black">{name}</span>
                    <span className="block truncate text-sm text-[var(--muted-text)]">
                      {entry.lastMessage ?? t("empty.noMessages")}
                    </span>
                  </span>
                  {entry.unreadCount > 0 && <Badge tone="red">{entry.unreadCount}</Badge>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <div className="grid min-w-0 grid-rows-[auto_1fr_auto]">
          {/* Header */}
          <header className="flex items-center justify-between gap-4 border-b border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarToken name={activeName} online={!!activeFriend} />
              <div className="min-w-0">
                <h2 className="m-0 truncate font-serif text-3xl font-bold">
                  {activeFriend ? activeName : t("empty.title")}
                </h2>
                {activeFriend && (
                  <p className="m-0 text-sm text-[var(--muted-text)]">{t("header.status")}</p>
                )}
              </div>
            </div>
            {activeFriend && (
              <Badge tone="mint">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {t("header.badge")}
              </Badge>
            )}
          </header>

          {/* Message thread */}
          <div
            aria-label={activeFriend ? t("conversationLabel", { name: activeName }) : t("title")}
            aria-live="polite"
            aria-relevant="additions text"
            className="grid content-end gap-5 overflow-y-auto p-5 sm:p-8"
            role="log"
          >
            {!activeConvId && (
              <p className="text-center text-sm text-[var(--muted-text)]">
                {t("empty.description")}
              </p>
            )}

            {messages.map((msg) => {
              // Compare sender ID to the logged-in user's ID
              const isMe = msg.sender?.id === currentUserId;
              const senderName = msg.sender?.displayName ?? msg.sender?.username ?? "Unknown";

              return (
                <div
                  key={msg.id}
                  className={`flex max-w-[82%] gap-3 ${isMe ? "flex-row-reverse justify-self-end" : ""}`}
                >
                  {!isMe && <AvatarToken name={senderName} size="sm" />}
                  <div
                    className={`rounded-md p-4 ${
                      isMe
                        ? "rounded-br-sm bg-[var(--mint)] text-[var(--primary-foreground)]"
                        : "rounded-bl-sm border border-[var(--panel-border-soft)] bg-white/[0.06] text-[var(--muted-strong)]"
                    }`}
                  >
                    {/* Show sender name above their messages */}
                    {!isMe && (
                      <p className="m-0 mb-1 text-xs font-bold text-[var(--brass)]">{senderName}</p>
                    )}
                    <p className={`m-0 ${isMe ? "font-bold" : ""}`}>{msg.body}</p>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="border-t border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-4"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <input
                type="text"
                name="message"
                autoComplete="off"
                aria-label={
                  activeFriend
                    ? t("composerPlaceholder", { name: activeName })
                    : t("empty.composerPlaceholder")
                }
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={
                  activeFriend
                    ? t("composerPlaceholder", { name: activeName })
                    : t("empty.composerPlaceholder")
                }
                disabled={!activeConvId || isSending}
                className="text-input"
              />
              <button
                type="submit"
                aria-label={t("send")}
                className="btn m-0 px-5"
                disabled={!messageText.trim() || !activeConvId || isSending}
              >
                <Send aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">{t("send")}</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </PageShell>
  );
}
