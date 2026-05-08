import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter } from "next/font/google";
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

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang={locale} className={cn("dark font-sans", inter.variable)}>
      <body>
        <NextIntlClientProvider>
          <PresenceProvider currentUsername={username} socketUrl={socketUrl}>
            <a className="skip-link" href="#app-main">
              Skip to Content
            </a>
            <div className="app-frame">
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
