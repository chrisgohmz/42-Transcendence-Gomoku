import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { ClickButtons } from "@/components/click-buttons";
import { StatusPanel } from "@/components/status-panel";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

type HomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default function Home({ params }: HomeProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const home = useTranslations("home");
  const socketUrl = process.env["SOCKET_PUBLIC_URL"] ?? "http://localhost:3001";

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{home("eyebrow")}</p>
        <h1>{home("title")}</h1>
        <p className="lede">{home("lede")}</p>
      </section>
      <section className="panel">
        <article className="card">
          <div className="label">{home("toggle.label")}</div>
          <p className="meta">{home("toggle.description")}</p>
          <ClickButtons />
        </article>
      </section>

      <section className="panel">
        <article className="card">
          <div className="label">{home("auth.label")}</div>
          <p className="meta">{home("auth.description")}</p>
          <div className="inline-links">
            <Link className="text-link" href="/signup">
              {home("auth.createAccount")}
            </Link>
            <Link className="text-link" href="/login">
              {home("auth.signIn")}
            </Link>
            <Link className="text-link" href="/account">
              {home("auth.accountPage")}
            </Link>
          </div>
        </article>
      </section>
      <section className="panel">
        <article className="card">
          <div className="label">{home("proto.label")}</div>
          <p className="meta">{home("proto.description")}</p>
          <div className="inline-links">
            <Link className="text-link" href="/proto">
              {home("proto.link")}
            </Link>
          </div>
        </article>
      </section>
      <section className="panel">
        <article className="card">
          <div className="label">Profile/Friends/Messaging</div>
          <p className="meta">
            View your personal statistics and edit your details. See your friends list, request or
            sent out. Message your friends.
          </p>
          <div className="inline-links">
            <Link className="text-link" href="/profile">
              Profile
            </Link>
            <Link className="text-link" href="/friends">
              Friends
            </Link>
            <Link className="text-link" href="/messages">
              Messages
            </Link>
          </div>
        </article>
      </section>
      <StatusPanel socketUrl={socketUrl} />
    </main>
  );
}
