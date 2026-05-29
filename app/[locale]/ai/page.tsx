import { setRequestLocale } from "next-intl/server";

import AiLobbyClient from "@/components/ai-lobby-client";
import { createPageMetadata } from "@/lib/page-metadata";

type AiPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = createPageMetadata("ai");

export default async function AiPage({ params }: AiPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AiLobbyClient />;
}
