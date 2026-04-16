import Link from "next/link";

import { ClickButtons } from "./components/click-buttons";
import { StatusPanel } from "./components/status-panel";

export const dynamic = "force-dynamic";

export default function Home() {
  const socketUrl = process.env["SOCKET_PUBLIC_URL"] ?? "http://localhost:3001";

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">42 Transcendence</p>
        <h1>One command boots the full local stack.</h1>
        <p className="lede">
          One Next.js app now serves the UI, auth, API routes, and Prisma-backed data, while a
          dedicated Bun realtime service handles Socket.IO.
        </p>
      </section>
      <section className="panel">
        <article className="card">
          <div className="label">Client Toggle Demo</div>
          <p className="meta">Click the button to flip local React state and update the UI.</p>
          <ClickButtons />
        </article>
      </section>

      <section className="panel">
        <article className="card">
          <div className="label">Authentication</div>
          <p className="meta">
            Sign up to create a session cookie, then visit the protected account page to verify
            guards, server-side session checks, and logout flows.
          </p>
          <div className="inline-links">
            <Link className="text-link" href="/signup">
              Create account
            </Link>
            <Link className="text-link" href="/login">
              Sign in
            </Link>
            <Link className="text-link" href="/account">
              Account page
            </Link>
          </div>
        </article>
      </section>
      <section className="panel">
        <article className="card">
          <div className="label">Prototype</div>
          <p className="meta">
            Create waiting matches and inspect the current match list through the unified app
            routes.
          </p>
          <div className="inline-links">
            <Link className="text-link" href="/proto">
              Open prototype page
            </Link>
          </div>
        </article>
      </section>
      <StatusPanel socketUrl={socketUrl} />
    </main>
  );
}
