import { KeyRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { BoardShowpiece, PageShell } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

type ForgotPasswordPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell wide={false} />}>
      <ForgotPasswordPageContent params={params} />
    </Suspense>
  );
}

async function ForgotPasswordPageContent({ params }: ForgotPasswordPageProps) {
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);

  const shared = await getTranslations({ locale, namespace: "auth.shared" });
  const reset = await getTranslations({ locale, namespace: "auth.passwordReset" });

  return (
    <PageShell wide={false}>
      <section className="grid overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel)] shadow-[0_34px_100px_rgba(0,0,0,0.46)] lg:grid-cols-[minmax(340px,0.8fr)_minmax(360px,0.72fr)]">
        <div className="grid min-h-[620px] content-between border-r border-[var(--panel-border-soft)] p-5 sm:p-8">
          <div>
            <p className="eyebrow mb-2">{shared("eyebrow")}</p>
            <h1 className="font-serif text-5xl leading-none font-black text-pretty">
              {reset("requestHeroTitle")}
            </h1>
          </div>

          <BoardShowpiece
            label={reset("boardLabel")}
            className="min-h-[390px] border-0 bg-transparent shadow-none"
          />
        </div>

        <div className="grid content-center p-6 sm:p-10">
          <section className="command-panel">
            <p className="eyebrow">{shared("eyebrow")}</p>
            <h2 className="flex items-center gap-3 font-serif text-4xl leading-none font-black">
              <KeyRound aria-hidden="true" className="size-7 text-[var(--brass)]" />
              {reset("requestTitle")}
            </h2>
            <p className="mt-4 mb-7 leading-7 text-[var(--muted-text)]">{reset("requestLede")}</p>
            <PasswordResetRequestForm />
          </section>
        </div>
      </section>
    </PageShell>
  );
}
