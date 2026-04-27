"use client";

import { MessageSquare, UserMinus, Check, X, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";

export default function FriendsContent() {
  const [activeTab, setActiveTab] = useState("friends");
  const t = useTranslations("friends");

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
            placeholder={t("searchPlaceholder")}
            className="flex-1 rounded-xl border border-slate-700/50 bg-[#0c1628] px-5 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
          />
          <button className="rounded-xl bg-[#4ee8c2] px-6 py-3 font-bold tracking-wider text-[#04131a] uppercase transition-transform hover:-translate-y-0.5">
            {t("search")}
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="mb-8 flex justify-center gap-4 border-b border-slate-700/50 pb-4">
          <button
            onClick={() => setActiveTab("friends")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "friends" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {t("tabs.friends")}
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "pending" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {t("tabs.pending")}
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "sent" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {t("tabs.sent")}
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
                  <tr className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/20">
                    <td className="p-4 text-slate-300">1</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-600"></div>
                        <span className="font-bold text-white">MJ</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">1200</td>
                    <td className="p-4 text-slate-300">65%</td>
                    <td className="p-4 text-slate-300">42</td>
                    <td className="p-4 text-slate-300">23</td>
                    <td className="flex justify-end gap-2 p-4">
                      <Link
                        href="/messages"
                        className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-bold transition-colors hover:bg-slate-700"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {t("actions.chat")}
                      </Link>
                      <button className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20">
                        <UserMinus className="h-4 w-4" />
                        {t("actions.remove")}
                      </button>
                    </td>
                  </tr>
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
                  <tr className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-600"></div>
                        <span className="font-bold text-white">Alex</span>
                      </div>
                    </td>
                    <td className="flex justify-end gap-2 p-4">
                      <button className="flex items-center gap-2 rounded-md bg-[#4ee8c2]/10 px-3 py-1.5 text-sm font-bold text-[#4ee8c2] transition-colors hover:bg-[#4ee8c2]/20">
                        <Check className="h-4 w-4" />
                        {t("actions.accept")}
                      </button>
                      <button className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20">
                        <X className="h-4 w-4" />
                        {t("actions.decline")}
                      </button>
                    </td>
                  </tr>
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
                  <tr className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-600"></div>
                        <span className="font-bold text-white">Liam</span>
                      </div>
                    </td>
                    <td className="flex justify-end p-4">
                      <button className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-700">
                        <X className="h-4 w-4" />
                        {t("actions.cancelRequest")}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
