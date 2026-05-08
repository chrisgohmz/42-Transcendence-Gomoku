import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import HomeDashboard from "@/components/home-dashboard";

export const dynamic = "force-dynamic";

type HomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function Home({ params }: HomeProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <HomeDashboard />;
}
