import { Crown, Swords } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BoardShowpiece, PageShell } from "@/components/gomoku-ui";
import { SignupForm } from "@/components/signup-form";
import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

type SignupPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function SignupPage({ params }: SignupPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getCurrentSession();

  if (session) {
    redirect({ href: "/account", locale });
  }

  const shared = await getTranslations({ locale, namespace: "auth.shared" });
  const signup = await getTranslations({ locale, namespace: "auth.signup" });

  return (
    <PageShell wide={false}>
      <section className="grid overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel)] shadow-[0_34px_100px_rgba(0,0,0,0.46)] lg:grid-cols-[minmax(360px,0.72fr)_minmax(380px,0.92fr)]">
        <div className="grid content-center p-6 sm:p-10">
          <section className="command-panel">
            <p className="eyebrow">{shared("eyebrow")}</p>
            <h1 className="font-serif text-4xl leading-none font-black">{signup("title")}</h1>
            <p className="mt-4 mb-7 leading-7 text-[var(--muted-text)]">{signup("lede")}</p>
            <SignupForm />
          </section>
        </div>

        <div className="grid min-h-[780px] content-between border-l border-[var(--panel-border-soft)] p-5 sm:p-8">
          <div>
            <p className="eyebrow mb-2">New Player File</p>
            <h2 className="font-serif text-5xl leading-none font-black text-pretty">
              Claim a seat, build a rating, keep the rematches coming.
            </h2>
          </div>

          <BoardShowpiece
            label="New player seat"
            className="min-h-[430px] border-0 bg-transparent shadow-none"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="kpi-card">
              <Crown aria-hidden="true" className="mb-4 size-5 text-[var(--brass)]" />
              <p className="m-0 font-black">Start at the ladder</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">
                Your account is ready for profile stats, friends, and future ranked flow.
              </p>
            </div>
            <div className="kpi-card">
              <Swords aria-hidden="true" className="mb-4 size-5 text-[var(--danger)]" />
              <p className="m-0 font-black">Challenge humans</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">
                Create rooms, join queues, and keep your match history in one shell.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
