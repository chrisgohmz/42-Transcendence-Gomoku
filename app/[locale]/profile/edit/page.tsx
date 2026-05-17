import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AvatarToken, Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

import ProfilePicture from "../profile-picture";
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
    <PageShell>
      <div className="mb-2">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm font-black text-[var(--brass)] no-underline hover:opacity-80"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Return to Profile
        </Link>
      </div>

      <PageHeader eyebrow={t("page.eyebrow")} title={t("title")} lede={t("lede")} />
      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("page.avatar.eyebrow")} title={t("page.avatar.title")}>
            <div className="grid justify-items-center">
              <ProfilePicture initialImage={sessionData.user.avatarUrl} />
            </div>
          </Surface>
          <Surface eyebrow={t("page.preview.eyebrow")} title={t("page.preview.title")}>
            <div className="flex items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3">
              <AvatarToken
                image={sessionData.user.avatarUrl}
                name={sessionData.user.displayName}
                online
              />
              <div className="min-w-0">
                <p className="m-0 truncate font-black">{sessionData.user.displayName}</p>
                <p className="m-0 truncate text-sm text-[var(--muted-text)]">
                  @{sessionData.user.username}
                </p>
              </div>
              <Badge tone="brass">{t("page.preview.rank")}</Badge>
            </div>
          </Surface>
        </aside>

        <EditProfileForm
          currentUsername={sessionData.user.username}
          currentDisplayName={sessionData.user.displayName}
        />
      </section>
    </PageShell>
  );
}
