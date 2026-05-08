"use client";

import { MessageSquare, Search, Send, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

const chats = [
  { id: "MJ", rank: "五段", status: "online", accent: "mint" },
  { id: "Alex", rank: "三段", status: "studying", accent: "brass" },
] as const;

export default function MessagesContent() {
  const searchParams = useSearchParams();
  const initialUser = searchParams.get("user") || "MJ";
  const [activeChat, setActiveChat] = useState(initialUser);
  const [messageText, setMessageText] = useState("");
  const [query, setQuery] = useState("");
  const t = useTranslations("messagesPage");

  useEffect(() => {
    const userParam = searchParams.get("user");
    if (userParam) setActiveChat(userParam);
  }, [searchParams]);

  const visibleChats = useMemo(
    () => chats.filter((chat) => chat.id.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessageText("");
  };

  return (
    <main className="app-shell app-shell-wide">
      <section className="command-panel mb-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="eyebrow">Social Table</p>
            <h1 className="page-title">{t("title")}</h1>
            <p className="lede">
              A match-first inbox for rivals, rematches, and live room invites.
            </p>
          </div>
          <label className="grid gap-2">
            <span className="field-label">{t("search")}</span>
            <span className="field-shell">
              <Search aria-hidden="true" className="size-4 text-[var(--brass)]" />
              <input
                type="text"
                name="messageSearch"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="text-input field-input"
              />
            </span>
          </label>
        </div>
      </section>

      <section className="grid min-h-[720px] overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#050807]/90 shadow-[0_30px_90px_rgba(0,0,0,0.4)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--panel-border-soft)] bg-[#07100d] p-3 lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center gap-2 px-2 py-1">
            <Sparkles aria-hidden="true" className="size-4 text-[var(--mint)]" />
            <p className="m-0 text-xs font-black tracking-[0.16em] text-[var(--muted-text)] uppercase">
              Conversations
            </p>
          </div>
          <div className="grid gap-2">
            {visibleChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => setActiveChat(chat.id)}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border p-3 text-left transition-[background-color,border-color] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${
                  activeChat === chat.id
                    ? "border-[var(--mint)]/35 bg-[var(--mint-soft)]"
                    : "border-transparent bg-white/[0.035] hover:border-[var(--panel-border-soft)] hover:bg-white/[0.06]"
                }`}
              >
                <span className="grid size-11 place-items-center rounded-full border border-[var(--panel-border-soft)] bg-white/[0.08] font-black">
                  {chat.id.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-black">{chat.id}</span>
                  <span className="block truncate text-sm text-[var(--muted-text)]">
                    {chat.id === "MJ" ? t("previews.mj") : t("previews.alex")}
                  </span>
                </span>
                <span className="text-xs font-black text-[var(--brass)]">{chat.rank}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 grid-rows-[auto_1fr_auto]">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--panel-border-soft)] bg-[#07100d] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full border border-[var(--mint)]/35 bg-[var(--mint-soft)] font-black">
                {activeChat.charAt(0)}
              </span>
              <div className="min-w-0">
                <h2 className="m-0 truncate font-serif text-2xl font-bold">{activeChat}</h2>
                <p className="m-0 text-sm text-[var(--muted-text)]">Ready for rematch invites</p>
              </div>
            </div>
            <MessageSquare aria-hidden="true" className="size-5 text-[var(--brass)]" />
          </header>

          <div className="grid content-end gap-4 overflow-y-auto p-5 sm:p-8">
            <div className="flex max-w-[82%] gap-3">
              <span className="mt-auto grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.08] font-black">
                {activeChat.charAt(0)}
              </span>
              <div className="rounded-lg rounded-bl-sm border border-[var(--panel-border-soft)] bg-white/[0.08] p-4 text-[var(--muted-strong)]">
                <p className="m-0">{t("thread.incoming")}</p>
              </div>
            </div>
            <div className="flex max-w-[82%] flex-row-reverse gap-3 justify-self-end">
              <div className="rounded-lg rounded-br-sm bg-[var(--mint)] p-4 text-[var(--primary-foreground)]">
                <p className="m-0 font-bold">{t("thread.outgoing")}</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-[var(--panel-border-soft)] bg-[#07100d] p-4"
          >
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input
                type="text"
                name="message"
                autoComplete="off"
                aria-label={t("composerPlaceholder", { name: activeChat })}
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder={t("composerPlaceholder", { name: activeChat })}
                className="text-input"
              />
              <button
                type="submit"
                className="btn m-0 px-5"
                disabled={messageText.trim().length === 0}
              >
                <Send aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">{t("send")}</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
