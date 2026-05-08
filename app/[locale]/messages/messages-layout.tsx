"use client";

import { MessageSquare, Send /*Search*/ } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function MessagesContent() {
  const searchParams = useSearchParams();
  const initialUser = searchParams.get("user") || "MJ";

  const [activeChat, setActiveChat] = useState(initialUser);
  const [messageText, setMessageText] = useState("");
  const t = useTranslations("messagesPage");

  useEffect(() => {
    const userParam = searchParams.get("user");
    if (userParam) {
      setActiveChat(userParam);
    }
  }, [searchParams]);

  return (
    <main className="app-shell app-shell-wide">
      <section className="mt-4 mb-12 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <MessageSquare aria-hidden="true" className="h-12 w-12 text-[var(--brass)]" />
          <h1 className="page-title">{t("title")}</h1>
        </div>

        <div className="flex w-full max-w-md gap-3">
          <input
            type="text"
            name="messageSearch"
            autoComplete="off"
            aria-label={t("search")}
            placeholder={t("searchPlaceholder")}
            className="text-input flex-1"
          />
          <button type="button" className="btn m-0 px-6 py-3">
            {t("search")}
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="flex h-[700px] w-full flex-row">
          <div className="flex w-1/3 min-w-[250px] flex-col border-r border-[var(--panel-border-soft)] bg-[#07100d] pt-2">
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => setActiveChat("MJ")}
                className={`flex items-center gap-3 rounded-md p-3 transition-colors focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${activeChat === "MJ" ? "bg-[var(--mint-soft)]" : "hover:bg-white/[0.06]"}`}
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.08]"></div>
                <div className="flex-1 overflow-hidden text-left">
                  <h3 className="m-0 font-bold text-white">MJ</h3>
                  <p className="m-0 truncate text-sm text-[var(--muted-text)]">
                    {t("previews.mj")}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveChat("Alex")}
                className={`flex items-center gap-3 rounded-md p-3 transition-colors focus-visible:ring-3 focus-visible:ring-[var(--mint)]/25 focus-visible:outline-none ${activeChat === "Alex" ? "bg-[var(--mint-soft)]" : "hover:bg-white/[0.06]"}`}
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.08]"></div>
                <div className="flex-1 overflow-hidden text-left">
                  <h3 className="m-0 font-bold text-white">Alex</h3>
                  <p className="m-0 truncate text-sm text-[var(--muted-text)]">
                    {t("previews.alex")}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-[#08110e]">
            <div className="flex items-center gap-4 border-b border-[var(--panel-border-soft)] bg-[#07100d] p-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.08]"></div>
              <h2 className="m-0 text-xl font-bold text-white">{activeChat}</h2>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              <div className="flex max-w-[80%] gap-3">
                <div className="mt-auto h-8 w-8 shrink-0 rounded-full bg-white/[0.08]"></div>
                <div className="rounded-lg rounded-bl-sm bg-white/[0.08] p-3 text-[var(--muted-strong)]">
                  <p className="m-0">{t("thread.incoming")}</p>
                </div>
              </div>
              <div className="flex max-w-[80%] flex-row-reverse gap-3 self-end">
                <div className="rounded-lg rounded-br-sm bg-[var(--mint)] p-3 text-[var(--primary-foreground)]">
                  <p className="m-0 font-medium">{t("thread.outgoing")}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--panel-border-soft)] bg-[#07100d] p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  name="message"
                  autoComplete="off"
                  aria-label={t("composerPlaceholder", { name: activeChat })}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t("composerPlaceholder", { name: activeChat })}
                  className="text-input flex-1"
                />
                <button
                  type="button"
                  className="btn m-0 flex shrink-0 items-center gap-2 px-6 py-3"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("send")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
