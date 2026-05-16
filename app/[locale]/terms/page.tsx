import { AlertTriangle, FileCheck2, Scale, ShieldCheck, Swords } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { Link } from "@/i18n/navigation";

type TermsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal.terms" });

  const sections = [
    {
      body: t("sections.accountAccess.body"),
      icon: ShieldCheck,
      id: "account-access",
      tone: "mint" as const,
      title: t("sections.accountAccess.title"),
    },
    {
      body: t("sections.fairPlay.body"),
      icon: Swords,
      id: "fair-play",
      tone: "mint" as const,
      title: t("sections.fairPlay.title"),
    },
    {
      body: t("sections.enforcement.body"),
      icon: AlertTriangle,
      id: "enforcement",
      tone: "red" as const,
      title: t("sections.enforcement.title"),
    },
  ];

  const badges = [
    {
      icon: ShieldCheck,
      id: "account-access",
      label: t("badges.accountAccess"),
      tone: "mint" as const,
    },
    {
      icon: Swords,
      id: "fair-play",
      label: t("badges.fairPlay"),
      tone: "mint" as const,
    },
    {
      icon: AlertTriangle,
      id: "enforcement",
      label: t("badges.enforcement"),
      tone: "red" as const,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow={t("eyebrow")}
        icon={Scale}
        title={t("title")}
        lede={t("intro")}
        actions={<Badge tone="brass">{t("lastUpdated")}</Badge>}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface eyebrow={t("document.eyebrow")} title={t("document.title")}>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {badges.map((badge) => {
              const Icon = badge.icon;
              return (
                <Badge key={badge.id} tone={badge.tone}>
                  <Icon aria-hidden="true" className="size-3.5" />
                  {badge.label}
                </Badge>
              );
            })}
          </div>
          <div className="grid gap-4">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <article
                  id={section.id}
                  key={section.id}
                  className="rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-5"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className={`grid size-10 place-items-center rounded-md border ${
                        section.tone === "red"
                          ? "border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.16)]"
                          : "border-[var(--mint)]/35 bg-[var(--mint-soft)]"
                      }`}
                    >
                      <Icon
                        aria-hidden="true"
                        className={`size-5 ${section.tone === "red" ? "text-[var(--danger)]" : "text-[var(--mint)]"}`}
                      />
                    </span>
                    <h2 className="font-serif text-3xl font-bold">{section.title}</h2>
                  </div>
                  <p className="m-0 max-w-3xl text-base leading-8 text-[var(--muted-strong)]">
                    {section.body}
                  </p>
                </article>
              );
            })}
          </div>
        </Surface>

        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("contents.eyebrow")} title={t("contents.title")}>
            <nav className="grid gap-2">
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="sidebar-link">
                  {section.title}
                </a>
              ))}
            </nav>
          </Surface>

          <Surface eyebrow={t("related.eyebrow")} icon={FileCheck2} title={t("related.title")}>
            <Link href="/privacy" className="sidebar-link">
              {t("related.privacyPolicy")}
            </Link>
            <div className="rounded-md border border-[var(--brass)]/35 bg-[var(--brass-soft)] p-3">
              <p className="m-0 text-sm font-black text-[var(--brass)]">
                {t("related.agreementTitle")}
              </p>
              <p className="m-0 mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                {t("related.agreementBody")}
              </p>
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}
