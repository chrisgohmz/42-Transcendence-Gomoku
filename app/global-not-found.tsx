import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { cookies } from "next/headers";

import { localeCookieName, resolveLocale, type Locale } from "@/i18n/config";
import { messageLoaders } from "@/i18n/messages";

import "./globals.css";

const manrope = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-sans",
});

const cormorant = Cormorant_Garamond({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

type NotFoundCopy = {
  title: string;
  description: string;
  returnHome: string;
};

async function getNotFoundLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;

  return resolveLocale(cookieLocale);
}

async function getNotFoundPage() {
  const locale = await getNotFoundLocale();
  const messages = await messageLoaders[locale]();

  return {
    copy: messages.notFound,
    locale,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getNotFoundPage();

  return {
    description: copy.description,
    icons: {
      icon: "/icons/Gomoku.svg",
    },
    title: copy.title,
  };
}

export default async function GlobalNotFound() {
  const { copy, locale } = await getNotFoundPage();

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`dark font-sans ${manrope.variable} ${cormorant.variable}`}
    >
      <body>
        <NotFoundContent copy={copy} locale={locale} />
      </body>
    </html>
  );
}

function NotFoundContent({ copy, locale }: { copy: NotFoundCopy; locale: Locale }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16 text-center font-sans">
      <div className="max-w-md">
        <h1 className="font-serif text-5xl leading-none font-bold text-[var(--text)]">
          {copy.title}
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted-text)]">{copy.description}</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- This standalone 404 must enter the localized root document. */}
        <a
          href={`/${locale}`}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--primary)]/50 bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] no-underline shadow-[0_14px_32px_rgb(121_220_138_/_14%)] transition-colors hover:bg-[var(--primary)]/90 focus-visible:ring-3 focus-visible:ring-[var(--ring)]/25 focus-visible:outline-none"
        >
          {copy.returnHome}
        </a>
      </div>
    </main>
  );
}
