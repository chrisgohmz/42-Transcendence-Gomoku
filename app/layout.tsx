import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "../node_modules/shadcn/dist/tailwind.css";
import "../node_modules/tw-animate-css/dist/tw-animate.css";
import "./globals.css";
import type { ReactNode } from "react";

import Footer from "@/components/footer";
import Navbar from "@/components/nav-bar";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Transcendence",
  description: "Local full-stack Next.js app for 42 Transcendence.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="bg-slate-100 text-slate-900">
        <Navbar />

        <main className="pt-16">{children}</main>

        <Footer />
      </body>
    </html>
  );
}
