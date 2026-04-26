import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function LoginPage({ params }: LoginPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const shared = useTranslations("auth.shared");
  const login = useTranslations("auth.login");

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
