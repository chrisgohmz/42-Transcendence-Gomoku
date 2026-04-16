"use client";

import Image from "next/image";
import Link from "next/link";

import UserMenu from "@/components/player-menu";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const isLoggedIn = true;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/40 bg-[#0b182d]/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-2 py-1 transition hover:bg-slate-800/70 active:scale-[0.98]"
        >
          <Image
            src="/icons/Gomoku.png"
            alt="Transcendence logo"
            width={42}
            height={42}
            className="rounded-md"
          />
          <span className="text-lg font-semibold text-slate-50">五目並べヒーロー</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="text-slate-30 rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-800/70 hover:text-white"
          >
            Home
          </Link>

          <Link
            href="/vs AI"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            vs AI
          </Link>

          <Link
            href="/vs Human"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            vs Human
          </Link>

          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            Leaderboard
          </Link>

          <Link
            href="https://en.wikipedia.org/wiki/Gomoku"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            Rules
          </Link>

          {!isLoggedIn ? (
            <>
              <Link href="login">
                <Button>Log In</Button>
              </Link>

              <Link href="/Sign Up">
                <Button>Sign Up</Button>
              </Link>
            </>
          ) : (
            <UserMenu />
          )}
        </div>
      </nav>
    </header>
  );
}
