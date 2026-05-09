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
      tone: "mint" as const,
      title: t("sections.accountAccess.title"),
    },
    {
      body: t("sections.fairPlay.body"),
      icon: Swords,
      tone: "mint" as const,
      title: t("sections.fairPlay.title"),
    },
    {
      body: "Cheating, harassment, account abuse, and attempts to interfere with another player's match can lead to restrictions or account removal.",
      icon: AlertTriangle,
      tone: "red" as const,
      title: "3. Enforcement",
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Legal"
        icon={Scale}
        title={t("title")}
        lede={t("intro")}
        actions={<Badge tone="brass">Last updated May 9, 2026</Badge>}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface eyebrow="Terms Document" title="Rules of the table">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <Badge tone="mint">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              Account access
            </Badge>
            <Badge tone="mint">
              <Swords aria-hidden="true" className="size-3.5" />
              Fair play
            </Badge>
            <Badge tone="red">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              Enforcement
            </Badge>
          </div>
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
          <Surface eyebrow="Contents" title="Sections">
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

          <Surface eyebrow="Related" icon={FileCheck2} title="Legal links">
            <Link href="/privacy" className="sidebar-link">
              Privacy Policy
            </Link>
            <div className="rounded-md border border-[var(--brass)]/35 bg-[var(--brass-soft)] p-3">
              <p className="m-0 text-sm font-black text-[var(--brass)]">By playing, you agree.</p>
              <p className="m-0 mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                These terms apply to account, social, and match features.
              </p>
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}
