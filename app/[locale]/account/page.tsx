import { Bell, Globe2, KeyRound, LockKeyhole, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/components/logout-button";
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

export default async function AccountPage({ params }: AccountPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "account" });
  const format = await getFormatter({ locale });
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
        eyebrow="Settings"
        icon={ShieldCheck}
        title="Account Settings"
        lede={session ? t("signedInLede") : t("signedOutLede")}
        actions={
          <Badge tone={session?.user.emailVerified ? "mint" : "brass"}>
            {session?.user.emailVerified ? "Email verified" : "Email pending"}
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
            <p className="eyebrow m-0 mb-3">Preferences</p>
            <div className="grid gap-2">
              {["Profile", "Security", "Language", "Privacy", "Notifications", "Danger Zone"].map(
                (item, index) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
                    className={`sidebar-link ${index === 0 ? "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]" : ""}`}
                  >
                    {item}
                  </a>
                ),
              )}
            </div>
          </aside>

          <div className="grid gap-5">
            <section className="grid gap-5 xl:grid-cols-2">
              <Surface eyebrow="Profile" icon={UserRound} title="Profile Information">
                <SettingsRow label={t("displayName")} value={session.user.displayName} />
                <SettingsRow label={t("username")} value={session.user.username} />
                <SettingsRow label={t("email")} value={session.user.email ?? t("emailMissing")} />
                <button type="button" className="btn m-0 w-fit">
                  Save Changes
                </button>
              </Surface>

              <Surface eyebrow="Security" icon={KeyRound} title="Email and Password">
                <SettingsRow
                  label={t("sessionExpires")}
                  value={format.dateTime(new Date(session.session.expiresAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
                <SettingsRow label="Password" value="Updated recently" />
                <SettingsRow
                  label="Session created"
                  value={format.dateTime(new Date(session.session.createdAt), {
                    dateStyle: "medium",
                  })}
                />
                <LogoutButton />
              </Surface>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <Surface eyebrow="Language" icon={Globe2} title="Region">
                <SettingsRow label="Interface language" value={<LocaleSwitcher />} />
                <SettingsRow label="Time zone" value="Asia/Singapore" />
              </Surface>

              <Surface eyebrow="Privacy" icon={LockKeyhole} title="Visibility">
                <ToggleRow enabled label="Show online status" />
                <ToggleRow enabled label="Allow match invites" />
                <ToggleRow label="Hide rating from strangers" />
              </Surface>

              <Surface eyebrow="Notifications" icon={Bell} title="Alerts">
                <ToggleRow enabled label="Friend requests" />
                <ToggleRow enabled label="Match reminders" />
                <ToggleRow label="Marketing email" />
              </Surface>
            </section>

            <Surface eyebrow="Danger Zone" icon={Trash2} title="Account Removal">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">
                  Deleting an account removes profile access and disconnects active sessions. Match
                  records may remain in aggregate ranking history.
                </p>
                <button type="button" className="btn btn-danger m-0">
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete Account
                </button>
              </div>
            </Surface>
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
