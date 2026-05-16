import {
  BrainCircuit,
  CircleGauge,
  Flag,
  Radio,
  RotateCcw,
  Settings,
  StepBack,
  Zap,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import GomokuBoard from "@/components/gomoku-board";
import { Badge, MetricCard, PageShell, Surface } from "@/components/gomoku-ui";

const moveHistory = [
  ["41", "H8", "black"],
  ["42", "G8", "white"],
  ["43", "F7", "black"],
  ["44", "F8", "white"],
  ["45", "E8", "black"],
  ["46", "D8", "white"],
  ["47", "D7", "black"],
] as const;

const blackStone = "radial-gradient(circle at 32% 28%, #4a463d 0 8%, #12100d 36%, #030303 100%)";
const whiteStone = "radial-gradient(circle at 34% 28%, #fffdf5 0 18%, #e8dfcf 54%, #a99f90 100%)";

type GamePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function GamePage({ params }: GamePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "game" });
  const controls = [
    { danger: false, id: "undo", icon: StepBack, label: t("controls.undo") },
    { danger: false, id: "restart", icon: RotateCcw, label: t("controls.restart") },
    { danger: false, id: "rules", icon: Settings, label: t("controls.rules") },
    { danger: true, id: "resign", icon: Flag, label: t("controls.resign") },
  ] as const;
  const roomDetails = [
    { label: t("match.details.rulesLabel"), value: t("match.details.rulesValue") },
    { label: t("match.details.captureLabel"), value: t("match.details.captureValue") },
    { label: t("match.details.spectatorsLabel"), value: t("match.details.spectatorsValue") },
    { label: t("match.details.openingLabel"), value: t("match.details.openingValue") },
  ] as const;
  const statusItems = [
    t("status.openThree"),
    t("status.whiteMustBlockD7"),
    t("status.blackTempoRetained"),
  ] as const;

  return (
    <PageShell>
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("ai.eyebrow")} title={t("ai.title")} icon={BrainCircuit}>
            <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">{t("ai.description")}</p>
            <div className="grid gap-3">
              <MetricCard
                icon={CircleGauge}
                label={t("ai.metrics.positionConfidence")}
                tone="brass"
                value="72%"
              />
              <MetricCard
                icon={Zap}
                label={t("ai.metrics.initiativeSwing")}
                tone="mint"
                value="+14"
              />
            </div>
            <div className="rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3">
              <p className="label m-0">{t("ai.suggestionLabel")}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                {t("ai.suggestion")}
              </p>
            </div>
          </Surface>
        </aside>

        <section className="board-room p-4 xl:p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <PlayerPlate name="Kuroaki" rank="5-dan" rating="1867" stone={blackStone} />
            <div className="rounded-md border border-[var(--mint)]/35 bg-[var(--mint-soft)] px-8 py-3 text-center">
              <p className="m-0 text-xs font-black tracking-[0.18em] text-[var(--muted-strong)] uppercase">
                {t("match.turn")}
              </p>
              <p className="m-0 text-4xl leading-none font-black text-[var(--mint)] tabular-nums">
                01:32
              </p>
            </div>
            <PlayerPlate
              name="Shiroyasha"
              rank="4-dan"
              rating="1724"
              stone={whiteStone}
              align="end"
            />
          </div>

          <GomokuBoard interactive className="mx-auto w-full max-w-[min(74vh,820px)]" />

          <div className="grid grid-cols-4 overflow-hidden rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)]">
            {controls.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`grid min-h-16 place-items-center gap-1 border-r border-[var(--panel-border-soft)] text-xs font-black last:border-r-0 hover:bg-white/[0.06] ${
                    item.danger ? "text-[var(--danger)]" : "text-[var(--muted-strong)]"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("match.roomEyebrow")} icon={Radio} title={t("match.roomTitle")}>
            <div className="grid gap-3 text-sm">
              {roomDetails.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--muted-text)]">{label}</span>
                  <span className="font-black">{value}</span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface eyebrow={t("history.eyebrow")} title={t("history.title")}>
            <div className="grid gap-2">
              {moveHistory.map(([move, position, color]) => (
                <div
                  key={move}
                  className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 ${
                    move === "47"
                      ? "border-[var(--mint)]/35 bg-[var(--mint-soft)]"
                      : "border-[var(--panel-border-soft)] bg-white/[0.035]"
                  }`}
                >
                  <span className="text-xs font-black text-[var(--muted-text)] tabular-nums">
                    {move}
                  </span>
                  <span
                    className="size-5 rounded-full border border-white/35 shadow-[inset_-4px_-5px_8px_rgba(0,0,0,0.28),inset_2px_2px_5px_rgba(255,255,255,0.22)]"
                    style={{ background: color === "black" ? blackStone : whiteStone }}
                    aria-hidden="true"
                  />
                  <span className="font-black tabular-nums">{position}</span>
                  {move === "47" ? <Badge tone="mint">{t("history.lastBadge")}</Badge> : null}
                </div>
              ))}
            </div>
          </Surface>

          <Surface eyebrow={t("status.eyebrow")} title={t("status.title")}>
            <div className="grid gap-3">
              {statusItems.map((item) => (
                <div
                  key={item}
                  className="rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3 text-sm font-bold text-[var(--muted-strong)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}

function PlayerPlate({
  align = "start",
  name,
  rank,
  rating,
  stone,
}: {
  align?: "start" | "end";
  name: string;
  rank: string;
  rating: string;
  stone: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${align === "end" ? "md:flex-row-reverse md:text-right" : ""}`}
    >
      <span
        className="size-14 rounded-full border border-[var(--brass)]/30 shadow-[inset_-8px_-10px_16px_rgba(0,0,0,0.28),inset_5px_5px_10px_rgba(255,255,255,0.22),0_10px_22px_rgba(0,0,0,0.28)]"
        style={{ background: stone }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="m-0 truncate text-xl font-black">{name}</p>
        <p className="m-0 text-sm text-[var(--muted-text)]">
          <span className="text-[var(--brass)]">{rank}</span> / {rating}
        </p>
      </div>
    </div>
  );
}
