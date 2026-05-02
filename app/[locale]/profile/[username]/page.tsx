import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { User } from "lucide-react";

type ProfilePageProps = {
  params: Promise<{
    locale: string;
    username: string;
  }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale, username } = await params;

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "profile" });

  const userProfile = await prisma.user.findUnique({
    where: { username },
    include: {
      gameStats: true,
    },
  });

  if (!userProfile) {
    notFound();
  }

  const statsList = userProfile.gameStats || [];
  const wins = statsList.reduce((total, stat) => total + stat.wins, 0);
  const losses = statsList.reduce((total, stat) => total + stat.losses, 0);
  const played = statsList.reduce((total, stat) => total + stat.matchesPlayed, 0);

  const rating = statsList.length > 0 ? Math.max(...statsList.map(s => s.rating || 0)) : 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  return (
    <main className="shell">
      <section className="mt-4 mb-12 flex flex-col items-center">
        <div className="mb-6 flex items-center gap-4">
          <User className="h-12 w-12 text-[#4ee8c2]" />
          <h1 className="m-0 text-5xl font-bold">{t("title")}</h1>
        </div>
      </section>

      <section className="panel">
        <div className="flex w-full flex-row items-stretch gap-8">

          <article className="card flex flex-1 flex-col items-center overflow-hidden text-center py-8">
            {userProfile.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.displayName}
                className="mb-6 h-48 w-48 rounded-full object-cover shadow-lg shadow-[#000000]/50"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-full bg-slate-600 text-6xl font-bold uppercase text-white shadow-lg shadow-[#000000]/50">
                {userProfile.displayName.charAt(0)}
              </div>
            )}
            <h2 className="m-0 px-4 text-2xl font-bold capitalize">
              {userProfile.displayName}
            </h2>
            <p className="meta m-0 text-sm text-slate-400">@{userProfile.username}</p>
          </article>

          <div className="flex flex-2 flex-col gap-8">
            <article className="card flex flex-1 flex-col">
              <h2 className="mb-6 text-2xl font-bold">{t("friendStatsTitle")}</h2>
              <div className="flex flex-1 flex-wrap gap-4">
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold text-[#4ee8c2]">{rating}</h2>
                  <p className="meta m-0 text-slate-400">{t("stats.rating")}</p>
                </div>
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold text-white">{winRate}%</h2>
                  <p className="meta m-0 text-slate-400">{t("stats.winRate")}</p>
                </div>
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold text-white">{wins}</h2>
                  <p className="meta m-0 text-slate-400">{t("stats.wins")}</p>
                </div>
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold text-white">{losses}</h2>
                  <p className="meta m-0 text-slate-400">{t("stats.losses")}</p>
                </div>
              </div>
            </article>
          </div>

        </div>
      </section>
    </main>
  );
}
