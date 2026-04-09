import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  return (
    <header className="border-b bg-white">
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
            href="/"
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

          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            vs AI
          </Link>

          <Link href="/login">
            <Button>Login</Button>
          </Link>

          <Link href="/signup">
            <Button>Sign Up</Button>
          </Link>
        </div>
      </nav>
    </header>
  )
}