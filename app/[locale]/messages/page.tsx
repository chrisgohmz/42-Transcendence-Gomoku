import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { PageLoadingShell } from "@/components/page-loading-shell";
import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

import MessagesContent from "./messages-layout";

type MessagesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

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

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
  }

  return <MessagesContent />;
}
