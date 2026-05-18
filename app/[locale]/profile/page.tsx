import { Pencil, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AvatarToken, Badge, PageShell } from "@/components/gomoku-ui";
import { PageLoadingShell } from "@/components/page-loading-shell";
import ProfileStatsPanel from "@/components/profile-stats-panel";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <ProfilePageContent params={params} />
    </Suspense>
  );
}

async function ProfilePageContent({ params }: ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: "profile" });
  const realUser = sessionData.user;

  return (
    <PageShell>
      <section className="command-panel mb-5">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-5">
            <AvatarToken image={realUser.avatarUrl} name={realUser.displayName} online size="lg" />
            <div className="min-w-0">
              <Badge tone="mint">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {t("page.hero.badge")}
              </Badge>
              <h1 className="mt-2 font-serif text-6xl leading-none font-bold max-sm:text-4xl">
                {realUser.displayName}
              </h1>
              <p className="text-lg text-[var(--muted-text)]">@{realUser.username}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/profile/edit" className="btn m-0">
              <Pencil aria-hidden="true" className="size-4" />
              {t("editProfile")}
            </Link>
            {/* <Link href="/account" className="btn btn-subtle m-0">
              Account Settings
            </Link> */}
          </div>
        </div>
      </section>

      <ProfileStatsPanel />
    </PageShell>
  );
}
