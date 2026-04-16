import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "../components/logout-button";
import { getCurrentSession, refreshSessionIfNeeded, serializeUserForResponse } from "../lib/auth";

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

  await refreshSessionIfNeeded(context);

  return {
    user: serializeUserForResponse(context.user),
    session: {
      id: context.session.id,
      expiresAt: context.session.expiresAt.toISOString(),
      createdAt: context.session.createdAt.toISOString(),
    },
  };
}

export default async function AccountPage() {
  let session: SessionPayload | null = null;
  let loadError: string | null = null;

  try {
    session = await loadSession();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load your session.";
  }

  if (!session && !loadError) {
    redirect("/login");
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Private area</p>
        <h1>{session ? session.user.displayName : "Account"}</h1>
        <p className="lede">
          {session
            ? "You are signed in. Use this page to verify session state and exit securely."
            : "Sign in to access your account details and protected pages."}
        </p>
      </section>

      <section className="panel">
        {loadError ? (
          <p className="error-text" role="alert">
            {loadError}
          </p>
        ) : null}

        {session ? (
          <div className="card">
            <div className="label">Signed-in user</div>
            <div className="meta">
              <div>
                <strong>Display name:</strong> {session.user.displayName}
              </div>
              <div>
                <strong>Username:</strong> {session.user.username}
              </div>
              <div>
                <strong>Email:</strong> {session.user.email ?? "Not provided"}
              </div>
              <div>
                <strong>Session expires:</strong>{" "}
                {new Date(session.session.expiresAt).toLocaleString()}
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <LogoutButton />
            </div>
          </div>
        ) : null}

        <div className="inline-links">
          <Link href="/" className="text-link">
            Back to home
          </Link>
          <Link href="/proto" className="text-link">
            Proto test room
          </Link>
        </div>
      </section>
    </main>
  );
}
