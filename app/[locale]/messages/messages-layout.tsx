"use client";

import { Check, MessageSquare, Search, Send, ShieldCheck, Swords, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import GomokuBoard from "@/components/gomoku-board";
import { AvatarToken, Badge, PageHeader, PageShell } from "@/components/gomoku-ui";

const chats = [
  { id: "MJ", rank: "5-dan", status: "online", unread: 2 },
  { id: "Alex", rank: "3-dan", status: "studying", unread: 0 },
  { id: "Hoshi", rank: "6-dan", status: "online", unread: 1 },
  { id: "Tenkei", rank: "2-dan", status: "away", unread: 0 },
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
    <PageShell>
      <PageHeader eyebrow={t("eyebrow")} icon={MessageSquare} title={t("title")} lede={t("lede")} />

      <section className="grid min-h-[760px] overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel)] shadow-[0_30px_90px_rgba(0,0,0,0.4)] xl:grid-cols-[350px_minmax(0,1fr)]">
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="text-input field-input"
              />
            </span>
          </label>

          <div className="grid gap-2">
            {visibleChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => setActiveChat(chat.id)}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3 text-left transition-[background-color,border-color] focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${
                  activeChat === chat.id
                    ? "border-[var(--mint)]/35 bg-[var(--mint-soft)]"
                    : "border-transparent bg-white/[0.035] hover:border-[var(--panel-border-soft)] hover:bg-white/[0.06]"
                }`}
              >
                <AvatarToken name={chat.id} online={chat.status === "online"} />
                <span className="min-w-0">
                  <span className="block truncate font-black">{chat.id}</span>
                  <span className="block truncate text-sm text-[var(--muted-text)]">
                    {chat.id === "MJ" ? t("previews.mj") : t("previews.alex")}
                  </span>
                </span>
                <span className="grid justify-items-end gap-1">
                  <span className="text-xs font-black text-[var(--brass)]">{chat.rank}</span>
                  {chat.unread > 0 ? <Badge tone="red">{chat.unread}</Badge> : null}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 grid-rows-[auto_1fr_auto]">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarToken name={activeChat} online />
              <div className="min-w-0">
                <h2 className="m-0 truncate font-serif text-3xl font-bold">{activeChat}</h2>
                <p className="m-0 text-sm text-[var(--muted-text)]">{t("header.status")}</p>
              </div>
            </div>
            <Badge tone="mint">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              {t("header.badge")}
            </Badge>
          </header>

          <div className="grid content-end gap-5 overflow-y-auto p-5 sm:p-8">
            <div className="flex max-w-[82%] gap-3">
              <AvatarToken name={activeChat} size="sm" />
              <div className="rounded-md rounded-bl-sm border border-[var(--panel-border-soft)] bg-white/[0.06] p-4 text-[var(--muted-strong)]">
                <p className="m-0">{t("thread.incoming")}</p>
              </div>
            </div>

            <div className="flex max-w-[82%] flex-row-reverse gap-3 justify-self-end">
              <div className="rounded-md rounded-br-sm bg-[var(--mint)] p-4 text-[var(--primary-foreground)]">
                <p className="m-0 font-bold">{t("thread.outgoing")}</p>
              </div>
            </div>

            <article className="max-w-xl rounded-md border border-[var(--brass)]/35 bg-[linear-gradient(135deg,rgba(216,172,89,0.16),rgba(255,255,255,0.04))] p-4">
              <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                <GomokuBoard className="w-full max-w-[120px]" />
                <div>
                  <Badge tone="brass">
                    <Swords aria-hidden="true" className="size-3.5" />
                    {t("invite.eyebrow")}
                  </Badge>
                  <h3 className="mt-3 font-serif text-2xl font-bold">{t("invite.title")}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">
                    {t("invite.description")}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" className="btn m-0 min-h-10 px-4">
                      <Check aria-hidden="true" className="size-4" />
                      {t("invite.accept")}
                    </button>
                    <button type="button" className="btn btn-danger m-0 min-h-10 px-4">
                      <X aria-hidden="true" className="size-4" />
                      {t("invite.decline")}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-4"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
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
    </PageShell>
  );
}
