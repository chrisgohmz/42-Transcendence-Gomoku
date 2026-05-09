import { Database, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";

type PrivacyPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const sections = [
    {
      body: t("sections.accountData.body"),
      icon: Database,
      title: t("sections.accountData.title"),
    },
    {
      body: t("sections.sessionCookies.body"),
      icon: LockKeyhole,
      title: t("sections.sessionCookies.title"),
    },
    {
      body: "Friend requests, presence, and match invitations are used to power social play. Private messages should be treated as product data until retention rules are finalized.",
      icon: ShieldCheck,
      title: "3. Social and Match Data",
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Legal"
        icon={ShieldCheck}
        title={t("title")}
        lede={t("intro")}
        actions={<Badge tone="brass">Last updated May 9, 2026</Badge>}
      />

      <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid content-start gap-5">
          <Surface eyebrow="Contents" title="On this page">
            <nav className="grid gap-2">
              {sections.map((section) => (
                <a
                  key={section.title}
                  href={`#${section.title.toLowerCase().replaceAll(" ", "-").replaceAll(".", "")}`}
                  className="sidebar-link"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </Surface>
          <MetricCard
            icon={FileText}
            label="Document Sections"
            tone="brass"
            value={sections.length}
          />
        </aside>

        <Surface eyebrow="Privacy Document" title="How data is handled">
          <div className="grid gap-4">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <article
                  id={section.title.toLowerCase().replaceAll(" ", "-").replaceAll(".", "")}
                  key={section.title}
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
            <p className="m-0 font-black text-[var(--mint)]">Questions about privacy?</p>
            <p className="m-0 mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              Contact the project maintainers before adding new analytics, retention, or moderation
              data surfaces.
            </p>
          </div>
        </Surface>
      </section>
    </PageShell>
  );
}
