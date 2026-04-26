"use client";

import { MessageSquare, UserMinus, Check, X, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function FriendsContent() {
  const [activeTab, setActiveTab] = useState("friends");

  return (
    <main className="shell">
      <section className="mt-4 mb-12 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <Users className="h-12 w-12 text-[#4ee8c2]" />
          <h1 className="m-0 text-5xl font-bold">Friends</h1>
        </div>
        <div className="flex w-full max-w-md gap-3">
          <input
            type="text"
            placeholder="Search by username..."
            className="flex-1 rounded-xl border border-slate-700/50 bg-[#0c1628] px-5 py-3 text-white transition-colors focus:border-[#4ee8c2] focus:outline-none"
          />
          <button className="rounded-xl bg-[#4ee8c2] px-6 py-3 font-bold tracking-wider text-[#04131a] uppercase transition-transform hover:-translate-y-0.5">
            Search
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="mb-8 flex justify-center gap-4 border-b border-slate-700/50 pb-4">
          <button
            onClick={() => setActiveTab("friends")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "friends" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "pending" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            Pending Requests
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`rounded-md px-4 py-2 font-bold transition-colors ${activeTab === "sent" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
          >
            Sent Requests
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {activeTab === "friends" && (
            <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-[#08101F] shadow-lg shadow-blue-500/10">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    <th className="p-4 font-bold text-slate-200">Rank</th>
                    <th className="p-4 font-bold text-slate-200">Friend</th>
                    <th className="p-4 font-bold text-slate-200">Rating</th>
                    <th className="p-4 font-bold text-slate-200">Win Rate</th>
                    <th className="p-4 font-bold text-slate-200">Wins</th>
                    <th className="p-4 font-bold text-slate-200">Losses</th>
                    <th className="p-4 text-right font-bold text-slate-200">Actions</th>
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
                        Chat
                      </Link>
                      <button className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20">
                        <UserMinus className="h-4 w-4" />
                        Remove
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
                    <th className="p-4 font-bold text-slate-200">Pending Requests</th>
                    <th className="p-4 text-right font-bold text-slate-200">Actions</th>
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
                        Accept
                      </button>
                      <button className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20">
                        <X className="h-4 w-4" />
                        Decline
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
                    <th className="p-4 font-bold text-slate-200">Sent Requests</th>
                    <th className="p-4 text-right font-bold text-slate-200">Actions</th>
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
                        Cancel Request
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
