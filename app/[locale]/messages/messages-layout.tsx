"use client";

import { MessageSquare, Send /*Search*/ } from "lucide-react";
import { useTranslations } from "next-intl";
//import Link from "next/link";
import { useState } from "react";

export default function MessagesContent() {
  const [activeChat, setActiveChat] = useState("MJ");
  const [messageText, setMessageText] = useState("");
  const t = useTranslations("messagesPage");

  return (
    <main className="shell">
      <section className="mt-4 mb-12 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <MessageSquare className="h-12 w-12 text-[#4ee8c2]" />
          <h1 className="m-0 text-5xl font-bold">{t("title")}</h1>
        </div>

        <div className="flex w-full max-w-md gap-3">
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            className="flex-1 rounded-xl border border-slate-700/50 bg-[#0c1628] px-5 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
          />
          <button className="rounded-xl bg-[#4ee8c2] px-6 py-3 font-bold tracking-wider text-[#04131a] uppercase transition-transform hover:-translate-y-0.5">
            {t("search")}
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden rounded-xl border border-slate-700/50 bg-[#08101F] p-0 shadow-2xl shadow-blue-500/10">
        <div className="flex h-[700px] w-full flex-row">
          <div className="flex w-1/3 min-w-[250px] flex-col border-r border-slate-700/50 bg-[#0b182d] pt-2">
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              <button
                onClick={() => setActiveChat("MJ")}
                className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${activeChat === "MJ" ? "bg-slate-800" : "hover:bg-slate-800/50"}`}
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-600"></div>
                <div className="flex-1 overflow-hidden text-left">
                  <h3 className="m-0 font-bold text-white">MJ</h3>
                  <p className="m-0 truncate text-sm text-slate-400">{t("previews.mj")}</p>
                </div>
              </button>
              <button
                onClick={() => setActiveChat("Alex")}
                className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${activeChat === "Alex" ? "bg-slate-800" : "hover:bg-slate-800/50"}`}
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-600"></div>
                <div className="flex-1 overflow-hidden text-left">
                  <h3 className="m-0 font-bold text-white">Alex</h3>
                  <p className="m-0 truncate text-sm text-slate-400">{t("previews.alex")}</p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-[#08101F]">
            <div className="flex items-center gap-4 border-b border-slate-700/50 bg-[#0b182d] p-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-slate-600"></div>
              <h2 className="m-0 text-xl font-bold text-white">{activeChat}</h2>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              <div className="flex max-w-[80%] gap-3">
                <div className="mt-auto h-8 w-8 shrink-0 rounded-full bg-slate-600"></div>
                <div className="rounded-2xl rounded-bl-sm bg-slate-800 p-3 text-slate-200">
                  <p className="m-0">{t("thread.incoming")}</p>
                </div>
              </div>
              <div className="flex max-w-[80%] flex-row-reverse gap-3 self-end">
                <div className="rounded-2xl rounded-br-sm bg-[#4ee8c2] p-3 text-[#04131a]">
                  <p className="m-0 font-medium">{t("thread.outgoing")}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700/50 bg-[#0b182d] p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t("composerPlaceholder", { name: activeChat })}
                  className="flex-1 rounded-xl border border-slate-700/50 bg-[#0c1628] px-4 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
                />
                <button className="flex shrink-0 items-center gap-2 rounded-xl bg-[#4ee8c2] px-6 py-3 font-bold text-[#04131a] transition-transform hover:-translate-y-0.5">
                  <Send className="h-4 w-4" />
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
