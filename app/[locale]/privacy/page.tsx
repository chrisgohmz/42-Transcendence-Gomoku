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
    <main className="app-shell max-w-3xl">
      <section className="panel">
        <p className="eyebrow">Legal</p>
        <h1 className="page-title text-4xl">{t("title")}</h1>
        <p className="lede">{t("intro")}</p>

        {sections.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.body}
          </Section>
        ))}
      </section>
    </main>
  );
}
