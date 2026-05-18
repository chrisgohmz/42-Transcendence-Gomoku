import { Bell, Globe2, KeyRound, LockKeyhole, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/components/logout-button";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { redirect } from "@/i18n/navigation";
import { getCurrentSession, serializeUserForResponse } from "@/lib/auth";

type SessionPayload = {
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    emailVerified: boolean;
  };
  session: {
    id: string;
    expiresAt: string;
    createdAt: string;
  };
};

async function loadSession(): Promise<SessionPayload | null> {
  const context = await getCurrentSession();

  if (!context) {
    return null;
  }

  return {
    user: serializeUserForResponse(context.user),
    session: {
      id: context.session.id,
      createdAt: context.session.createdAt.toISOString(),
      expiresAt: context.session.expiresAt.toISOString(),
    },
  };
}

type AccountPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function AccountPage({ params }: AccountPageProps) {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <AccountPageContent params={params} />
    </Suspense>
  );
}

async function AccountPageContent({ params }: AccountPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "account" });
  const format = await getFormatter({ locale });
  const settingsNavItems = [
    { id: "profile", label: t("settings.sidebar.profile") },
    { id: "security", label: t("settings.sidebar.security") },
    { id: "language", label: t("settings.sidebar.language") },
    { id: "privacy", label: t("settings.sidebar.privacy") },
    { id: "notifications", label: t("settings.sidebar.notifications") },
    { id: "danger", label: t("settings.sidebar.danger") },
  ] as const;
  let session: SessionPayload | null = null;
  let loadError: string | null = null;

  try {
    session = await loadSession();
  } catch (error) {
    loadError = error instanceof Error ? error.message : t("loadError");
  }

  if (!session && !loadError) {
    redirect({ href: "/login", locale });
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        icon={ShieldCheck}
        title={t("settings.title")}
        lede={session ? t("signedInLede") : t("signedOutLede")}
        actions={
          <Badge tone={session?.user.emailVerified ? "mint" : "brass"}>
            {session?.user.emailVerified ? t("settings.emailVerified") : t("settings.emailPending")}
          </Badge>
        }
      />

      {loadError ? (
        <p
          className="mb-5 rounded-md border border-[var(--danger)]/35 bg-[rgb(216_60_52_/_0.16)] p-4 text-sm font-bold text-[var(--danger)]"
          role="alert"
        >
          {loadError}
        </p>
      ) : null}

      {session ? (
        <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="command-panel content-start">
            <p className="eyebrow m-0 mb-3">{t("settings.preferences")}</p>
            <div className="grid gap-2">
              {settingsNavItems.map((item, index) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`sidebar-link ${index === 0 ? "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]" : ""}`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </aside>

          <div className="grid gap-5">
            <section className="grid gap-5 xl:grid-cols-2">
              <section id="profile" className="scroll-mt-24">
                <Surface
                  eyebrow={t("settings.sections.profile.eyebrow")}
                  icon={UserRound}
                  title={t("settings.sections.profile.title")}
                >
                  <SettingsRow label={t("displayName")} value={session.user.displayName} />
                  <SettingsRow label={t("username")} value={session.user.username} />
                  <SettingsRow label={t("email")} value={session.user.email ?? t("emailMissing")} />
                  <button type="button" className="btn m-0 w-fit">
                    {t("settings.sections.profile.saveChanges")}
                  </button>
                </Surface>
              </section>

              <section id="security" className="scroll-mt-24">
                <Surface
                  eyebrow={t("settings.sections.security.eyebrow")}
                  icon={KeyRound}
                  title={t("settings.sections.security.title")}
                >
                  <SettingsRow
                    label={t("sessionExpires")}
                    value={format.dateTime(new Date(session.session.expiresAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  />
                  <SettingsRow
                    label={t("settings.sections.security.password")}
                    value={t("settings.sections.security.updatedRecently")}
                  />
                  <SettingsRow
                    label={t("settings.sections.security.sessionCreated")}
                    value={format.dateTime(new Date(session.session.createdAt), {
                      dateStyle: "medium",
                    })}
                  />
                  <LogoutButton />
                </Surface>
              </section>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <section id="language" className="scroll-mt-24">
                <Surface
                  eyebrow={t("settings.sections.language.eyebrow")}
                  icon={Globe2}
                  title={t("settings.sections.language.title")}
                >
                  <SettingsRow
                    label={t("settings.sections.language.interfaceLanguage")}
                    value={<LocaleSwitcher />}
                  />
                  <SettingsRow
                    label={t("settings.sections.language.timeZone")}
                    value="Asia/Singapore"
                  />
                </Surface>
              </section>

              <section id="privacy" className="scroll-mt-24">
                <Surface
                  eyebrow={t("settings.sections.privacy.eyebrow")}
                  icon={LockKeyhole}
                  title={t("settings.sections.privacy.title")}
                >
                  <ToggleRow enabled label={t("settings.sections.privacy.showOnlineStatus")} />
                  <ToggleRow enabled label={t("settings.sections.privacy.allowMatchInvites")} />
                  <ToggleRow label={t("settings.sections.privacy.hideRatingFromStrangers")} />
                </Surface>
              </section>

              <section id="notifications" className="scroll-mt-24">
                <Surface
                  eyebrow={t("settings.sections.notifications.eyebrow")}
                  icon={Bell}
                  title={t("settings.sections.notifications.title")}
                >
                  <ToggleRow enabled label={t("settings.sections.notifications.friendRequests")} />
                  <ToggleRow enabled label={t("settings.sections.notifications.matchReminders")} />
                  <ToggleRow label={t("settings.sections.notifications.marketingEmail")} />
                </Surface>
              </section>
            </section>

            <section id="danger" className="scroll-mt-24">
              <Surface
                eyebrow={t("settings.sections.danger.eyebrow")}
                icon={Trash2}
                title={t("settings.sections.danger.title")}
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">
                    {t("settings.sections.danger.description")}
                  </p>
                  <button type="button" className="btn btn-danger m-0">
                    <Trash2 aria-hidden="true" className="size-4" />
                    {t("settings.sections.danger.deleteAccount")}
                  </button>
                </div>
              </Surface>
            </section>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

function SettingsRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid min-h-14 grid-cols-[minmax(120px,0.42fr)_minmax(0,1fr)] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3">
      <span className="text-sm font-black text-[var(--muted-text)]">{label}</span>
      <span className="min-w-0 font-bold break-words">{value}</span>
    </div>
  );
}

function ToggleRow({ enabled = false, label }: { enabled?: boolean; label: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3">
      <span className="text-sm font-bold text-[var(--muted-strong)]">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full border ${
          enabled
            ? "border-[var(--mint)]/35 bg-[var(--mint-soft)]"
            : "border-[var(--panel-border-soft)] bg-white/[0.05]"
        }`}
      >
        <span
          className={`absolute top-1 size-4 rounded-full ${
            enabled ? "left-6 bg-[var(--mint)]" : "left-1 bg-[var(--muted-text)]"
          }`}
        />
      </span>
    </div>
  );
}
