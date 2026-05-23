import { ArrowLeft, KeyRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import { AvatarToken, Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import {
  OAuthAccountConnections,
  type OAuthProviderConnection,
} from "@/components/oauth-account-connections";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { Link, redirect } from "@/i18n/navigation";
import {
  auth,
  getConfiguredOAuthProviders,
  getCurrentSession,
  hasCredentialPassword,
} from "@/lib/auth";
import { oauthProviderIds, type OAuthProviderId } from "@/lib/oauth-providers";

import ProfilePicture from "../profile-picture";
import EditProfileForm from "./edit-form";

type EditProfilePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

async function loadOAuthProviders(): Promise<OAuthProviderConnection[]> {
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const configuredProviders = new Set(getConfiguredOAuthProviders());
  const linkedAccounts = new Map(
    accounts
      .filter((account) => oauthProviderIds.includes(account.providerId as OAuthProviderId))
      .map((account) => [account.providerId as OAuthProviderId, account]),
  );

  return oauthProviderIds.map((provider) => {
    const linkedAccount = linkedAccounts.get(provider);

    return {
      accountId: linkedAccount?.accountId ?? null,
      canUnlink: Boolean(linkedAccount) && accounts.length > 1,
      configured: configuredProviders.has(provider),
      id: provider,
      linked: Boolean(linkedAccount),
    };
  });
}

export default function EditProfilePage({ params }: EditProfilePageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <EditProfilePageContent params={params} />
    </Suspense>
  );
}

async function EditProfilePageContent({ params }: EditProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect({ href: "/login", locale });
    return null;
  }

  const [accountT, oauthProviders, t, hasPassword] = await Promise.all([
    getTranslations({ locale, namespace: "account" }),
    loadOAuthProviders(),
    getTranslations({ locale, namespace: "profile.edit" }),
    hasCredentialPassword(sessionData.user.id),
  ]);

  return (
    <PageShell>
      <div className="mb-2">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm font-black text-(--brass) no-underline hover:opacity-80"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("returnToProfile")}
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
            <div className="flex items-center gap-3 rounded-md border border-(--panel-border-soft) bg-white/[0.035] p-3">
              <AvatarToken
                image={sessionData.user.avatarUrl}
                name={sessionData.user.displayName}
                online
              />
              <div className="min-w-0">
                <p className="m-0 truncate font-black">{sessionData.user.displayName}</p>
                <p className="m-0 truncate text-sm text-(--muted-text)">
                  @{sessionData.user.username}
                </p>
              </div>
              <Badge tone="brass">{t("page.preview.rank")}</Badge>
            </div>
          </Surface>
        </aside>
        <div className="grid content-start gap-5">
          <EditProfileForm
            currentUsername={sessionData.user.username}
            currentDisplayName={sessionData.user.displayName}
            currentEmail={sessionData.user.email}
            hasPassword={hasPassword}
          />
          <Surface
            eyebrow={accountT("settings.sections.connections.eyebrow")}
            icon={KeyRound}
            title={accountT("settings.sections.connections.title")}
          >
            <OAuthAccountConnections
              callbackPath="/profile/edit"
              locale={locale}
              providers={oauthProviders}
            />
          </Surface>
        </div>
      </section>
    </PageShell>
  );
}
