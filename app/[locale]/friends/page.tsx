import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

import FriendsContent from "./friends-layout";

type FriendsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function FriendsPage({ params }: FriendsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
  }

  return <FriendsContent />;
}
