import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import Section from "@/components/section";

type PrivacyPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("legal.privacy");

  const sections = [
    {
      body: t("sections.accountData.body"),
      title: t("sections.accountData.title"),
    },
    {
      body: t("sections.sessionCookies.body"),
      title: t("sections.sessionCookies.title"),
    },
  ];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-4 text-slate-200">{t("intro")}</p>

      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.body}
        </Section>
      ))}
    </main>
  );
}
