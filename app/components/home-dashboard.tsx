import { Bot, Swords } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ActionCard, BoardShowpiece, PageShell } from "@/components/gomoku-ui";

export default async function HomeDashboard() {
  const t = await getTranslations("home.dashboard");

  return (
    <PageShell className="grid gap-5">
      <section className="command-panel overflow-hidden">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(430px,0.7fr)] xl:items-center">
          <div className="min-w-0">
            <h1 className="mt-6 max-w-[11ch] font-serif text-7xl leading-[0.92] font-bold text-pretty max-lg:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted-strong)]">
              {t("hero.lede")}
            </p>
          </div>

          <BoardShowpiece label={t("board.label")} className="min-h-[520px]" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ActionCard
          body={t("cards.ai.body")}
          cta={t("cards.ai.cta")}
          href="/ai"
          icon={Bot}
          title={t("cards.ai.title")}
          tone="mint"
        />
        <ActionCard
          body={t("cards.human.body")}
          cta={t("cards.human.cta")}
          href="/human"
          icon={Swords}
          title={t("cards.human.title")}
          tone="red"
        />
      </section>
    </PageShell>
  );
}
