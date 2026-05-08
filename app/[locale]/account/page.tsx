import { KeyRound, ShieldCheck } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { LogoutButton } from "@/components/logout-button";
import { Link, redirect } from "@/i18n/navigation";
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
      expiresAt: context.session.expiresAt.toISOString(),
      createdAt: context.session.createdAt.toISOString(),
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
    <main className="app-shell">
      <section className="command-panel mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="page-title">
              {session ? session.user.displayName : t("fallbackTitle")}
            </h1>
            <p className="lede">{session ? t("signedInLede") : t("signedOutLede")}</p>
          </div>
          <ShieldCheck aria-hidden="true" className="size-10 text-[var(--mint)]" />
        </div>
      </section>

      <section className="surface-panel">
        {loadError ? (
          <p className="error-text" role="alert">
            {loadError}
          </p>
        ) : null}

        {session ? (
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="command-panel shadow-none">
              <div className="mb-5 flex items-center gap-3">
                <KeyRound aria-hidden="true" className="size-5 text-[var(--brass)]" />
                <div className="label m-0">{t("signedInUser")}</div>
              </div>
              <div className="grid gap-3">
                {[
                  [t("displayName"), session.user.displayName],
                  [t("username"), session.user.username],
                  [t("email"), session.user.email ?? t("emailMissing")],
                  [
                    t("sessionExpires"),
                    format.dateTime(new Date(session.session.expiresAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-2 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3 sm:grid-cols-[180px_1fr]"
                  >
                    <span className="font-black text-[var(--muted-text)]">{label}</span>
                    <span className="min-w-0 break-words">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="command-panel content-start shadow-none md:w-72">
              <p className="label">Session Controls</p>
              <LogoutButton />
            </div>
          </div>
        ) : null}

        <div className="inline-links">
          <Link href="/" className="text-link">
            {t("backHome")}
          </Link>
          <Link href="/proto" className="text-link">
            {t("protoRoom")}
          </Link>
        </div>
      </section>
    </main>
  );
}
