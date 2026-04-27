import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { SignupForm } from "@/components/signup-form";

type SignupPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function SignupPage({ params }: SignupPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const shared = useTranslations("auth.shared");
  const signup = useTranslations("auth.signup");

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{shared("eyebrow")}</p>
        <h1>{signup("title")}</h1>
        <p className="lede">{signup("lede")}</p>
      </section>

      <section className="panel">
        <SignupForm />
      </section>
    </main>
  );
}
