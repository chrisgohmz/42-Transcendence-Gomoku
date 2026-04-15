import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import Navbar from "@/components/nav-bar";
import Footer from "@/components/footer";

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
