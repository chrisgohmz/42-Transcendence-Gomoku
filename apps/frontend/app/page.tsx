import { ClickButtons } from "../components/click-buttons";
import { StatusPanel } from "../components/status-panel";

export const dynamic = "force-dynamic";

export default function Home() {
  const socketUrl = process.env["SOCKET_PUBLIC_URL"] ?? "http://localhost:3001";

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">42 Transcendence</p>
        <h1>One command boots the full local stack.</h1>
        <p className="lede">
          The frontend talks to the backend, the backend checks PostgreSQL
          through Prisma, and Socket.IO is available for realtime features.
        </p>
      </section>
      <section className="panel">
        <article className="card">
          <div className="label">Client Toggle Demo</div>
          <p className="meta">
            Click the button to flip local React state and update the UI.
          </p>
          <ClickButtons />
        </article>
      </section>
      <StatusPanel socketUrl={socketUrl} />
    </main>
  );
}
