import { setRequestLocale } from "next-intl/server";

import HumanLobbyClient from "@/components/human-lobby-client";

type VsHumanProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function VsHuman({ params }: VsHumanProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HumanLobbyClient />;
}
