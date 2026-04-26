import { setRequestLocale } from "next-intl/server";

import { ProtoClient } from "@/components/proto/proto-client";

type ProtoPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function ProtoPage({ params }: ProtoPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ProtoClient />;
}
