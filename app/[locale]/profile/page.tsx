import {
  Activity,
  Award,
  Pencil,
  ShieldCheck,
  Trophy,
  UserRound,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AvatarToken, Badge, MetricCard, PageShell, Surface } from "@/components/gomoku-ui";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const recentMatches = [
  ["Kuroaki vs Shiroyasha", "Won", "+14", "01:32 left"],
  ["Kuroaki vs Tenkei", "Lost", "-8", "resigned"],
  ["Kuroaki vs Mokuren", "Won", "+11", "five in row"],
] as const;

export default async function ProfilePage({ params }: ProfilePageProps) {
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
                Signed in
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Trophy} label={t("stats.rating")} tone="brass" value="0" />
            <MetricCard icon={Activity} label={t("stats.winRate")} tone="mint" value="0%" />
            <MetricCard icon={TrendingUp} label={t("stats.wins")} tone="mint" value="0" />
            <MetricCard icon={TrendingDown} label={t("stats.losses")} tone="red" value="0" />
          </div>

          <Surface eyebrow="Recent Matches" title="Last table sessions">
            <div className="overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
              {recentMatches.map(([match, result, delta, note]) => (
                <article
                  key={match}
                  className="grid min-h-16 grid-cols-[minmax(0,1fr)_80px_70px_minmax(120px,0.5fr)] items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-3 last:border-b-0"
                >
                  <span className="truncate font-black">{match}</span>
                  <Badge tone={result === "Won" ? "mint" : "red"}>{result}</Badge>
                  <span
                    className={`font-black tabular-nums ${
                      delta.startsWith("+") ? "text-[var(--mint)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {delta}
                  </span>
                  <span className="truncate text-sm text-[var(--muted-text)]">{note}</span>
                </article>
              ))}
            </div>
          </Surface>
        </div>

        <aside className="grid content-start gap-5">
          <Surface eyebrow="About Me" icon={UserRound} title="Player card">
            <p className="m-0 leading-7 text-[var(--muted-text)]">
              Calm center openings, fast rematches, and a weakness for ladder-breaking diagonals.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Rank" tone="brass" value="5-dan" />
              <MetricCard label="Season" tone="mint" value="#3" />
            </div>
          </Surface>

          <Surface eyebrow="Achievements" icon={Award} title="Badges">
            <div className="grid gap-2">
              {["Open Four Specialist", "100 Ranked Wins", "Study Room Host"].map((item) => (
                <Badge key={item} tone="brass">
                  <Award aria-hidden="true" className="size-3.5" />
                  {item}
                </Badge>
              ))}
            </div>
          </Surface>

          <Surface eyebrow="Season Progress" title="Next rank">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                <span>5-dan to 6-dan</span>
                <span className="text-[var(--mint)]">68%</span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <span className="block h-full w-[68%] rounded-full bg-[linear-gradient(90deg,var(--mint),var(--brass))]" />
              </span>
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}
