import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import Navbar from "@/components/nav-bar";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Transcendence Frontend",
  description: "Containerized frontend for local development.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <Navbar />
      <body>{children}</body>
    </html>
  );
}
