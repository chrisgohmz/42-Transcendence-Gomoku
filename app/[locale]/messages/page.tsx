import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { PageLoadingShell } from "@/components/page-loading-shell";
import { redirect } from "@/i18n/navigation";
import { getCurrentSessionIdentity } from "@/lib/auth";
import { createPageMetadata } from "@/lib/page-metadata";

import MessagesContent from "./messages-layout";

type MessagesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = createPageMetadata("messages");

export default function MessagesPage({ params }: MessagesPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <MessagesPageContent params={params} />
    </Suspense>
  );
}

async function MessagesPageContent({ params }: MessagesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionData = await getCurrentSessionIdentity();

  if (!sessionData) {
    redirect({ href: "/login", locale });
  }

  //return <MessagesContent />;
  // Pass the current user's ID so the chat panel knows which messages are "mine"
  return <MessagesContent currentUserId={sessionData!.user.id} />;
}
