import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { LocaleSwitcher } from "@/components/locale-switcher";
import UserMenu from "@/components/player-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

export default async function Navbar() {
  const [sessionData, brand, nav] = await Promise.all([
    getCurrentSession(),
    getTranslations("brand"),
    getTranslations("nav"),
  ]);
  const isLoggedIn = sessionData !== null;
  const realUsername = sessionData?.user.username;
  const avatarUrl = sessionData?.user.avatarUrl;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/40 bg-[#0b182d]/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-2 py-1 transition hover:bg-slate-800/70 active:scale-[0.98]"
        >
          <Image
            src="/icons/Gomoku.svg"
            alt={brand("logoAlt")}
            width={42}
            height={42}
            className="rounded-md"
          />
          <span className="text-lg font-semibold text-slate-50">{brand("name")}</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="text-slate-30 rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-800/70 hover:text-white"
          >
            {nav("home")}
          </Link>

          <Link
            href="/vs-ai"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            {nav("vsAi")}
          </Link>

          <Link
            href="/human"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            {nav("vsHuman")}
          </Link>

          <Link
            href="/leaderboard"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            {nav("leaderboard")}
          </Link>

          <a
            href="https://en.wikipedia.org/wiki/Gomoku"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white"
          >
            {nav("rules")}
          </a>

          <LocaleSwitcher />

          {!isLoggedIn ? (
            <>
              <Link href="/login">
                <Button>{nav("login")}</Button>
              </Link>

              <Link href="/signup">
                <Button>{nav("signup")}</Button>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <UserMenu username={realUsername} avatarUrl={avatarUrl} />
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
