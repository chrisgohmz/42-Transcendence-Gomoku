"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, UserMinus, Check, X, Users } from "lucide-react";

export default function FriendsPage()
{
    const [activeTab, setActiveTab] = useState("friends");
    return (
        <main className="shell">
            <section className="flex flex-col items-center mb-12 mt-4">
                <div className="flex items-center gap-4 mb-6">
                    <Users className="w-12 h-12 text-[#4ee8c2]" />
                    <h1 className="text-5xl font-bold m-0">Friends</h1>
                </div>
                <div className="flex w-full max-w-md gap-3">
                    <input
                        type="text"
                        placeholder="Search by username..."
                        className="flex-1 px-5 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-[#4ee8c2] transition-colors"
                    />
                    <button className="px-6 py-3 bg-[#4ee8c2] text-[#04131a] font-bold uppercase tracking-wider rounded-xl transition-transform hover:-translate-y-0.5">
                        Search
                    </button>
                </div>
            </section>
            <section className="panel">
				<div className="flex justify-center gap-4 mb-8 border-b border-slate-700/50 pb-4">
                    <button
                        onClick={() => setActiveTab("friends")}
                        className={`px-4 py-2 font-bold rounded-md transition-colors ${activeTab === "friends" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
                    >
                        Friends
                    </button>
                    <button
                        onClick={() => setActiveTab("pending")}
                        className={`px-4 py-2 font-bold rounded-md transition-colors ${activeTab === "pending" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
                    >
                        Pending Requests
                    </button>
                    <button
                        onClick={() => setActiveTab("sent")}
                        className={`px-4 py-2 font-bold rounded-md transition-colors ${activeTab === "sent" ? "bg-[#4ee8c2] text-[#04131a]" : "text-slate-300 hover:bg-slate-800"}`}
                    >
                        Sent Requests
                    </button>
                </div>
                <div className="flex flex-col gap-4">
                    {activeTab === "friends" && (
                        <div className="bg-[#08101F] rounded-xl overflow-hidden shadow-lg shadow-blue-500/10 border border-slate-700/50">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-800/50 border-b border-slate-700/50">
                                        <th className="p-4 font-bold text-slate-200">Rank</th>
                                        <th className="p-4 font-bold text-slate-200">Friend</th>
                                        <th className="p-4 font-bold text-slate-200">Rating</th>
                                        <th className="p-4 font-bold text-slate-200">Win Rate</th>
                                        <th className="p-4 font-bold text-slate-200">Wins</th>
                                        <th className="p-4 font-bold text-slate-200">Losses</th>
                                        <th className="p-4 font-bold text-slate-200 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-700/50 hover:bg-slate-800/20 transition-colors">
                                        <td className="p-4 text-slate-300">1</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-600 rounded-full"></div>
                                                <span className="font-bold text-white">MJ</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-300">1200</td>
                                        <td className="p-4 text-slate-300">65%</td>
                                        <td className="p-4 text-slate-300">42</td>
                                        <td className="p-4 text-slate-300">23</td>
                                        <td className="p-4 flex justify-end gap-2">
                                            <Link href="/messages" className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-sm font-bold transition-colors">
                                                <MessageSquare className="w-4 h-4" />
                                                Chat
                                            </Link>
                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-sm font-bold transition-colors">
                                                <UserMinus className="w-4 h-4" />
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === "pending" && (
                        <div className="bg-[#08101F] rounded-xl overflow-hidden shadow-lg shadow-blue-500/10 border border-slate-700/50">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-800/50 border-b border-slate-700/50">
                                        <th className="p-4 font-bold text-slate-200">Pending Requests</th>
                                        <th className="p-4 font-bold text-slate-200 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-700/50 hover:bg-slate-800/20 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-600 rounded-full"></div>
                                                <span className="font-bold text-white">Alex</span>
                                            </div>
                                        </td>
                                        <td className="p-4 flex justify-end gap-2">
                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-[#4ee8c2]/10 hover:bg-[#4ee8c2]/20 text-[#4ee8c2] rounded-md text-sm font-bold transition-colors">
                                                <Check className="w-4 h-4" />
                                                Accept
                                            </button>
                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-sm font-bold transition-colors">
                                                <X className="w-4 h-4" />
                                                Decline
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === "sent" && (
                        <div className="bg-[#08101F] rounded-xl overflow-hidden shadow-lg shadow-blue-500/10 border border-slate-700/50">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-800/50 border-b border-slate-700/50">
                                        <th className="p-4 font-bold text-slate-200">Sent Requests</th>
                                        <th className="p-4 font-bold text-slate-200 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-700/50 hover:bg-slate-800/20 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-600 rounded-full"></div>
                                                <span className="font-bold text-white">Liam</span>
                                            </div>
                                        </td>
                                        <td className="p-4 flex justify-end">
                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-sm font-bold transition-colors">
                                                <X className="w-4 h-4" />
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