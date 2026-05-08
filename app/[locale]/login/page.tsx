import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

import GomokuBoard from "@/components/gomoku-board";
import { LoginForm } from "@/components/login-form";
import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getCurrentSession();

  if (session) {
    redirect({ href: "/account", locale });
  }

  const shared = await getTranslations({ locale, namespace: "auth.shared" });
  const login = await getTranslations({ locale, namespace: "auth.login" });

  return (
    <main className="app-shell">
      <section className="grid overflow-hidden rounded-lg border border-[var(--panel-border-soft)] bg-[#08110e]/90 shadow-[0_30px_90px_rgba(0,0,0,0.42)] lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,1fr)]">
        <div className="hidden min-h-[660px] border-r border-[var(--panel-border-soft)] bg-[#050807] p-8 lg:grid">
          <div className="flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Image src="/icons/Gomoku.svg" alt="" width={48} height={48} className="rounded-lg" />
              <div>
                <p className="font-black" translate="no">
                  五目並べヒーロー
                </p>
                <p className="text-xs tracking-[0.24em] text-[var(--brass)] uppercase">
                  Transcendence
                </p>
              </div>
            </div>
            <GomokuBoard className="mx-auto w-full max-w-sm" />
            <p className="font-serif text-3xl leading-tight text-pretty">
              Read the line before the line reads you.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <section className="hero">
            <p className="eyebrow">{shared("eyebrow")}</p>
            <h1>{login("title")}</h1>
            <p className="lede">{login("lede")}</p>
          </section>

          <section className="surface-card">
            <LoginForm />
          </section>
        </div>
      </section>
    </main>
  );
}
