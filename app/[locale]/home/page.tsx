import { setRequestLocale } from "next-intl/server";

import HomeDashboard from "@/components/home-dashboard";

type HomePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeDashboard />;
}
