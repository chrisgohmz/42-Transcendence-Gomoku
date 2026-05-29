import { setRequestLocale } from "next-intl/server";

import HumanLobbyClient from "@/components/human-lobby-client";
import { createPageMetadata } from "@/lib/page-metadata";

type VsHumanProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = createPageMetadata("human");

export default async function VsHuman({ params }: VsHumanProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HumanLobbyClient />;
}
