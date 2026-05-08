import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

import EditProfileForm from "./edit-form";

type EditProfilePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function EditProfilePage({ params }: EditProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: "profile.edit" });

  return (
    <main className="app-shell flex flex-col items-center">
      <section className="hero mt-4 mb-8 flex w-full flex-col items-center justify-center text-center">
        <h1 className="page-title">{t("title")}</h1>
        <p className="lede mx-auto">{t("lede")}</p>
      </section>
      <section className="mx-auto w-full max-w-4xl">
        <EditProfileForm
          currentUsername={sessionData.user.username}
          currentDisplayName={sessionData.user.displayName}
        />
      </section>
    </main>
  );
}
