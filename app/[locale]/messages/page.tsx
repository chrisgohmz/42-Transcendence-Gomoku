import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

import MessagesContent from "./messages-layout";

type MessagesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function MessagesPage({ params }: MessagesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
  }

  return <MessagesContent />;
}
