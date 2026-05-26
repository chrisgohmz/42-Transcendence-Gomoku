import { AlertTriangle, KeyRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { BoardShowpiece, PageShell } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { PasswordResetConfirmForm } from "@/components/password-reset-confirm-form";
import { Link } from "@/i18n/navigation";

type ResetPasswordPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
    token?: string | string[];
  }>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell wide={false} />}>
      <ResetPasswordPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPasswordPageContent({ params, searchParams }: ResetPasswordPageProps) {
  await connection();
  const { locale } = await params;
  const query = (await searchParams) ?? {};
  const token = firstSearchValue(query.token);
  const error = firstSearchValue(query.error);
  setRequestLocale(locale);

  const shared = await getTranslations({ locale, namespace: "auth.shared" });
  const reset = await getTranslations({ locale, namespace: "auth.passwordReset" });
  const resetToken = token && !error ? token : null;

  return (
    <PageShell wide={false}>
      <section className="grid overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel)] shadow-[0_34px_100px_rgba(0,0,0,0.46)] lg:grid-cols-[minmax(340px,0.8fr)_minmax(360px,0.72fr)]">
        <div className="grid min-h-[620px] content-between border-r border-[var(--panel-border-soft)] p-5 sm:p-8">
          <div>
            <p className="eyebrow mb-2">{shared("eyebrow")}</p>
            <h1 className="font-serif text-5xl leading-none font-black text-pretty">
              {reset("resetHeroTitle")}
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
              {resetToken ? (
                <KeyRound aria-hidden="true" className="size-7 text-[var(--brass)]" />
              ) : (
                <AlertTriangle aria-hidden="true" className="size-7 text-[var(--danger)]" />
              )}
              {resetToken ? reset("resetTitle") : reset("invalidTokenTitle")}
            </h2>
            <p className="mt-4 mb-7 leading-7 text-[var(--muted-text)]">
              {resetToken ? reset("resetLede") : reset("invalidTokenBody")}
            </p>
            {resetToken ? (
              <PasswordResetConfirmForm token={resetToken} />
            ) : (
              <Link href="/forgot-password" className="btn m-0 w-full">
                {reset("requestNewLink")}
              </Link>
            )}
          </section>
        </div>
      </section>
    </PageShell>
  );
}
