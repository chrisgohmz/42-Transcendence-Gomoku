import { ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { BoardShowpiece, PageShell } from "@/components/gomoku-ui";
import { LoginForm } from "@/components/login-form";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function LoginPage({ params }: LoginPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell wide={false} />}>
      <LoginPageContent params={params} />
    </Suspense>
  );
}

async function LoginPageContent({ params }: LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getCurrentSession();

  if (session) {
    redirect({ href: "/account", locale });
  }

  const shared = await getTranslations({ locale, namespace: "auth.shared" });
  const login = await getTranslations({ locale, namespace: "auth.login" });

  return (
    <PageShell wide={false}>
      <section className="grid overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel)] shadow-[0_34px_100px_rgba(0,0,0,0.46)] lg:grid-cols-[minmax(360px,0.9fr)_minmax(360px,0.72fr)]">
        <div className="grid min-h-[700px] content-between border-r border-[var(--panel-border-soft)] p-5 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">{shared("eyebrow")}</p>
              <h1 className="font-serif text-5xl leading-none font-black text-pretty">
                {login("page.hero.title")}
              </h1>
            </div>
            <div className="hidden rounded-md border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-3 py-2 text-right sm:block">
              <p className="m-0 text-xs font-black tracking-[0.14em] text-[var(--muted-strong)] uppercase">
                {login("page.session.eyebrow")}
              </p>
              <p className="m-0 text-lg font-black text-[var(--mint)]">
                {login("page.session.status")}
              </p>
            </div>
          </div>

          <BoardShowpiece
            label={login("page.boardLabel")}
            className="min-h-[430px] border-0 bg-transparent shadow-none"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="kpi-card">
              <ShieldCheck aria-hidden="true" className="mb-4 size-5 text-[var(--mint)]" />
              <p className="m-0 font-black">{login("page.highlights.protected.title")}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">
                {login("page.highlights.protected.body")}
              </p>
            </div>
            <div className="kpi-card">
              <Sparkles aria-hidden="true" className="mb-4 size-5 text-[var(--brass)]" />
              <p className="m-0 font-black">{login("page.highlights.rankedReady.title")}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">
                {login("page.highlights.rankedReady.body")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid content-center p-6 sm:p-10">
          <section className="command-panel">
            <p className="eyebrow">{shared("eyebrow")}</p>
            <h2 className="font-serif text-4xl leading-none font-black">{login("title")}</h2>
            <p className="mt-4 mb-7 leading-7 text-[var(--muted-text)]">{login("lede")}</p>
            <LoginForm />
          </section>
        </div>
      </section>
    </PageShell>
  );
}
