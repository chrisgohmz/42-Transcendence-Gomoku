import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import HomeDashboard from "@/components/home-dashboard";
import { createPageMetadata } from "@/lib/page-metadata";

type HomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = createPageMetadata("home", "/");

export default function Home({ params }: HomeProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <HomeDashboard />;
}
