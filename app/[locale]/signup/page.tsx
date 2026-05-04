import { getTranslations, setRequestLocale } from "next-intl/server";

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
