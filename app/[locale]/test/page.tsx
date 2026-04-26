import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

type TestPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function HomePage({ params }: TestPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("test");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">{t("body")}</p>
      </section>
    </main>
  );
}
