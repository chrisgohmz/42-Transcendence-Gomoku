import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { notFound } from "next/navigation";

import "../../node_modules/shadcn/dist/tailwind.css";
import "../../node_modules/tw-animate-css/dist/tw-animate.css";
import "../globals.css";
import { Suspense, type ReactNode } from "react";

import AppSidebar from "@/components/app-sidebar";
import { PresenceProvider, PresenceSessionSync } from "@/components/presence-provider";
import { routing } from "@/i18n/routing";
import { getCurrentSessionIdentity } from "@/lib/auth";
import { cn } from "@/lib/utils";

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

type RootLayoutProps = {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

type MetadataProps = {
  params: RootLayoutProps["params"];
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    description: t("description"),
    icons: {
      icon: "/icons/Gomoku.svg",
    },
    title: t("title"),
  };
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} className={cn("dark font-sans", manrope.variable, cormorant.variable)}>
      <body>
        <NextIntlClientProvider>
          <PresenceProvider>
            <Suspense fallback={null}>
              <PresenceSession />
            </Suspense>
            <a className="skip-link" href="#app-main">
              Skip to Content
            </a>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            >
              <div className="absolute top-0 right-0 h-72 w-[760px] bg-[url('/ui/bamboo-accent.svg')] bg-contain bg-right-top bg-no-repeat opacity-[0.18] mix-blend-screen" />
              <div className="absolute bottom-[-5rem] left-[var(--sidebar-width)] h-80 w-[720px] rotate-180 bg-[url('/ui/bamboo-accent.svg')] bg-contain bg-left-bottom bg-no-repeat opacity-[0.08] mix-blend-screen" />
            </div>
            <div className="app-frame relative z-10">
              <Suspense fallback={<AppSidebarFallback />}>
                <AppSidebar />
              </Suspense>
              <div id="app-main" className="app-content">
                {children}
              </div>
            </div>
          </PresenceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

async function PresenceSession() {
  const context = await getCurrentSessionIdentity();

  return <PresenceSessionSync username={context?.user.username} />;
}

function AppSidebarFallback() {
  return (
    <>
      <aside className="app-sidebar" aria-hidden="true">
        <div className="sidebar-brand">
          <div className="size-[52px] rounded-md bg-white/[0.08]" />
          <span className="grid flex-1 gap-2">
            <span className="h-5 w-36 rounded-sm bg-white/[0.08]" />
            <span className="h-3 w-28 rounded-sm bg-white/[0.05]" />
          </span>
        </div>
        <div className="mt-8 grid gap-3">
          <div className="h-4 w-12 rounded-sm bg-white/[0.05]" />
          <div className="h-11 rounded-md bg-white/[0.05]" />
          <div className="h-11 rounded-md bg-white/[0.05]" />
          <div className="h-11 rounded-md bg-white/[0.05]" />
        </div>
        <div className="mt-8 grid gap-3">
          <div className="h-4 w-14 rounded-sm bg-white/[0.05]" />
          <div className="h-11 rounded-md bg-white/[0.05]" />
          <div className="h-11 rounded-md bg-white/[0.05]" />
          <div className="h-11 rounded-md bg-white/[0.05]" />
        </div>
        <div className="mt-auto h-28 rounded-md bg-white/[0.05]" />
      </aside>
      <header className="mobile-topbar" aria-hidden="true">
        <div className="size-10 rounded-md bg-white/[0.08]" />
        <div className="h-5 flex-1 rounded-sm bg-white/[0.06]" />
        <div className="size-10 rounded-md bg-white/[0.06]" />
      </header>
    </>
  );
}
