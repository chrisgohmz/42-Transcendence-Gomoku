import { setRequestLocale } from "next-intl/server";

import AiLobbyClient from "@/components/ai-lobby-client";

type AiPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function AiPage({ params }: AiPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AiLobbyClient />;
}
