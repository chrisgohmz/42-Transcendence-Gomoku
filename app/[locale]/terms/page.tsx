import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import Section from "@/components/section";

type TermsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function TermsPage({ params }: TermsPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("legal.terms");

  const sections = [
    {
      body: t("sections.accountAccess.body"),
      title: t("sections.accountAccess.title"),
    },
    {
      body: t("sections.fairPlay.body"),
      title: t("sections.fairPlay.title"),
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
