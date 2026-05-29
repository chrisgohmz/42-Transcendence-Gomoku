import { setRequestLocale } from "next-intl/server";

import HomeDashboard from "@/components/home-dashboard";
import { createPageMetadata } from "@/lib/page-metadata";

type HomePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = createPageMetadata("home", "/home");

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeDashboard />;
}
