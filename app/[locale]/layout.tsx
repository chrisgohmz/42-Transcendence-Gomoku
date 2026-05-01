import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";

import "../../node_modules/shadcn/dist/tailwind.css";
import "../../node_modules/tw-animate-css/dist/tw-animate.css";
import "../globals.css";
import type { ReactNode } from "react";

import Footer from "@/components/footer";
import Navbar from "@/components/nav-bar";
import { PresenceProvider } from "@/components/presence-provider";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { getCurrentSession } from "@/lib/auth";

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

	return (
	  <html lang={locale} className={cn("font-sans", inter.variable)}>
		<body className="bg-slate-100 text-slate-900">
		  <NextIntlClientProvider>
			<PresenceProvider currentUsername={username}>
			  <Navbar />

            <main className="pt-16">{children}</main>

            <Footer />
          </PresenceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}