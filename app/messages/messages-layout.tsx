"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Send, Search } from "lucide-react";

export default function MessagesContent() {
    const [activeChat, setActiveChat] = useState("MJ");
    const [messageText, setMessageText] = useState("");

    return (
        <main className="shell">
            <section className="flex flex-col items-center mb-12 mt-4">
                <div className="flex items-center gap-4 mb-6">
                    <MessageSquare className="w-12 h-12 text-[#4ee8c2]" />
                    <h1 className="text-5xl font-bold m-0">Messages</h1>
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

            <section className="panel p-0 overflow-hidden bg-[#08101F] border border-slate-700/50 shadow-2xl shadow-blue-500/10 rounded-xl">
                <div className="flex flex-row w-full h-[700px]">

                    <div className="w-1/3 min-w-[250px] border-r border-slate-700/50 flex flex-col bg-[#0b182d] pt-2">
                        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                            <button onClick={() => setActiveChat("MJ")} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeChat === "MJ" ? "bg-slate-800" : "hover:bg-slate-800/50"}`}>
                                <div className="w-10 h-10 bg-slate-600 rounded-full shrink-0"></div>
                                <div className="text-left flex-1 overflow-hidden">
                                    <h3 className="font-bold text-white m-0">MJ</h3>
                                    <p className="text-sm text-slate-400 m-0 truncate">Absolutely! Let me just finish...</p>
                                </div>
                            </button>
                            <button onClick={() => setActiveChat("Alex")} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeChat === "Alex" ? "bg-slate-800" : "hover:bg-slate-800/50"}`}>
                                <div className="w-10 h-10 bg-slate-600 rounded-full shrink-0"></div>
                                <div className="text-left flex-1 overflow-hidden">
                                    <h3 className="font-bold text-white m-0">Alex</h3>
                                    <p className="text-sm text-slate-400 m-0 truncate">GG well played.</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-[#08101F] min-w-0">
                        <div className="p-4 border-b border-slate-700/50 bg-[#0b182d] flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-600 rounded-full shrink-0"></div>
                            <h2 className="text-xl font-bold text-white m-0">{activeChat}</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            <div className="flex gap-3 max-w-[80%]">
                                <div className="w-8 h-8 bg-slate-600 rounded-full shrink-0 mt-auto"></div>
                                <div className="bg-slate-800 text-slate-200 p-3 rounded-2xl rounded-bl-sm">
                                    <p className="m-0">Hey Max! Are you free for a game of Gomoku later?</p>
                                </div>
                            </div>
                            <div className="flex gap-3 max-w-[80%] self-end flex-row-reverse">
                                <div className="bg-[#4ee8c2] text-[#04131a] p-3 rounded-2xl rounded-br-sm">
                                    <p className="m-0 font-medium">Absolutely! Let me just finish setting up this profile page first.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-700/50 bg-[#0b182d]">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    placeholder={`Message ${activeChat}...`}
                                    className="flex-1 px-4 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-[#4ee8c2] transition-colors"
                                />
                                <button className="px-6 py-3 bg-[#4ee8c2] text-[#04131a] font-bold rounded-xl transition-transform hover:-translate-y-0.5 flex items-center gap-2 shrink-0">
                                    <Send className="w-4 h-4" />
                                    <span className="hidden sm:inline">Send</span>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </section>
        </main>
    );
}
