import { getTranslations, setRequestLocale } from "next-intl/server";

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
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{shared("eyebrow")}</p>
        <h1>{login("title")}</h1>
        <p className="lede">{login("lede")}</p>
      </section>

      <section className="panel">
        <LoginForm />
      </section>
    </main>
  );
}
