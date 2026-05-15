import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { notFound } from "next/navigation";

import "../../node_modules/shadcn/dist/tailwind.css";
import "../../node_modules/tw-animate-css/dist/tw-animate.css";
import "../globals.css";
import type { ReactNode } from "react";

import AppSidebar from "@/components/app-sidebar";
import { PresenceProvider } from "@/components/presence-provider";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth";
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
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const context = await getCurrentSession();
  const username = context?.user?.username;
  const socketUrl = process.env["SOCKET_PUBLIC_URL"];

  return (
    <html lang={locale} className={cn("dark font-sans", manrope.variable, cormorant.variable)}>
      <body>
        <NextIntlClientProvider>
          <PresenceProvider currentUsername={username} socketUrl={socketUrl}>
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
              <AppSidebar />
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
