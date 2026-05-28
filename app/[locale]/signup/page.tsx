import { Crown, Swords } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { BoardShowpiece, PageShell } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { SignupForm } from "@/components/signup-form";
import { redirect } from "@/i18n/navigation";
import { getConfiguredOAuthProviders, getCurrentSessionIdentity } from "@/lib/auth";
import { getOAuthCallbackErrorMessage } from "@/lib/oauth-callback-messages";
import { createPageMetadata } from "@/lib/page-metadata";

type SignupPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export const generateMetadata = createPageMetadata("signup");

export default function SignupPage({ params, searchParams }: SignupPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell wide={false} />}>
      <SignupPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SignupPageContent({ params, searchParams }: SignupPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getCurrentSessionIdentity();

  if (session) {
    redirect({ href: "/profile", locale });
  }

  const [shared, signup, oauthErrorMessage] = await Promise.all([
    getTranslations({ locale, namespace: "auth.shared" }),
    getTranslations({ locale, namespace: "auth.signup" }),
    getOAuthCallbackErrorMessage({ locale, namespace: "auth.oauth", searchParams }),
  ]);
  const oauthProviders = getConfiguredOAuthProviders();

  return (
    <PageShell wide={false}>
      <section className="grid overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel)] shadow-[0_34px_100px_rgba(0,0,0,0.46)] lg:grid-cols-[minmax(360px,0.72fr)_minmax(380px,0.92fr)]">
        <div className="grid content-center p-6 sm:p-10">
          <section className="command-panel">
            <p className="eyebrow">{shared("eyebrow")}</p>
            <h1 className="font-serif text-4xl leading-none font-black">{signup("title")}</h1>
            <p className="mt-4 mb-7 leading-7 text-[var(--muted-text)]">{signup("lede")}</p>
            <SignupForm oauthErrorMessage={oauthErrorMessage} oauthProviders={oauthProviders} />
          </section>
        </div>

        <div className="grid min-h-[780px] content-between border-l border-[var(--panel-border-soft)] p-5 sm:p-8">
          <div>
            <p className="eyebrow mb-2">{signup("page.hero.badge")}</p>
            <h2 className="font-serif text-5xl leading-none font-black text-pretty">
              {signup("page.hero.title")}
            </h2>
          </div>

          <BoardShowpiece
            label={signup("page.boardLabel")}
            className="min-h-[430px] border-0 bg-transparent shadow-none"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="kpi-card">
              <Crown aria-hidden="true" className="mb-4 size-5 text-[var(--brass)]" />
              <p className="m-0 font-black">{signup("page.highlights.ladder.title")}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">
                {signup("page.highlights.ladder.body")}
              </p>
            </div>
            <div className="kpi-card">
              <Swords aria-hidden="true" className="mb-4 size-5 text-[var(--danger)]" />
              <p className="m-0 font-black">{signup("page.highlights.humans.title")}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">
                {signup("page.highlights.humans.body")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
