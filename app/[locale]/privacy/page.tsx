import { Database, LockKeyhole, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { createPageMetadata } from "@/lib/page-metadata";

type PrivacyPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = createPageMetadata("privacy");

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const sections = [
    {
      body: t("sections.accountData.body"),
      icon: Database,
      id: "account-data",
      title: t("sections.accountData.title"),
    },
    {
      body: t("sections.sessionCookies.body"),
      icon: LockKeyhole,
      id: "session-cookies",
      title: t("sections.sessionCookies.title"),
    },
    {
      body: t("sections.socialMatchData.body"),
      icon: ShieldCheck,
      id: "social-match-data",
      title: t("sections.socialMatchData.title"),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow={t("eyebrow")}
        icon={ShieldCheck}
        title={t("title")}
        lede={t("intro")}
        actions={<Badge tone="brass">{t("lastUpdated")}</Badge>}
      />

      <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
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
        </aside>

        <Surface eyebrow={t("document.eyebrow")} title={t("document.title")}>
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
                    <span className="grid size-10 place-items-center rounded-md border border-[var(--brass)]/35 bg-[var(--brass-soft)]">
                      <Icon aria-hidden="true" className="size-5 text-[var(--brass)]" />
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

          <div className="rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)] p-4">
            <p className="m-0 font-black text-[var(--mint)]">{t("questions.title")}</p>
            <p className="m-0 mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              {t("questions.body")}
            </p>
          </div>
        </Surface>
      </section>
    </PageShell>
  );
}
