"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import UserMenu from "@/components/player-menu"
export default function Navbar() {
  const isLoggedIn = false

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          五目並べヒーロー
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            Home
          </Link>

          <Link
            href="/vs AI"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            vs AI
          </Link>

          <Link
            href="/vs Human"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            vs Human
          </Link>

          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            Leaderboard
          </Link>

          <Link
            href="https://en.wikipedia.org/wiki/Gomoku"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            Rules
          </Link>

          {!isLoggedIn ? (
            <>
                <Link href="/login">
                    <Button>Log In</Button>
                </Link>

                <Link href="/Sign Up">
                  <Button>Sign Up</Button>
                </Link>
            </>
            ) : 
            < UserMenu />
          }

        </div>
      </nav>
    </header>
  )
}