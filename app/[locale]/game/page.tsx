import { setRequestLocale } from "next-intl/server";

import AiLobbyClient from "@/components/ai-lobby-client";

type GamePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function GamePage({ params }: GamePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AiLobbyClient />;
}
