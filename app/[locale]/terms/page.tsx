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
