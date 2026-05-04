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
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{session ? session.user.displayName : t("fallbackTitle")}</h1>
        <p className="lede">{session ? t("signedInLede") : t("signedOutLede")}</p>
      </section>

      <section className="panel">
        {loadError ? (
          <p className="error-text" role="alert">
            {loadError}
          </p>
        ) : null}

        {session ? (
          <div className="card">
            <div className="label">{t("signedInUser")}</div>
            <div className="meta">
              <div>
                <strong>{t("displayName")}</strong> {session.user.displayName}
              </div>
              <div>
                <strong>{t("username")}</strong> {session.user.username}
              </div>
              <div>
                <strong>{t("email")}</strong> {session.user.email ?? t("emailMissing")}
              </div>
              <div>
                <strong>{t("sessionExpires")}</strong>{" "}
                {format.dateTime(new Date(session.session.expiresAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
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
