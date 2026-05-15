import {
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Crosshair,
  Gauge,
  Info,
  Lightbulb,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import GomokuBoard from "@/components/gomoku-board";
import { Badge, PageShell, Surface } from "@/components/gomoku-ui";
import { cn } from "@/lib/utils";

type DifficultyTone = "blue" | "brass" | "mint" | "purple";

type Difficulty = {
  icon: LucideIcon;
  name: string;
  range: string;
  selected?: boolean;
  summary: string;
  tone: DifficultyTone;
};

const difficulties: Difficulty[] = [
  {
    icon: Bot,
    name: "Beginner",
    range: "Level 1 - 800",
    summary: "Calm openings",
    tone: "mint",
  },
  {
    icon: Bot,
    name: "Apprentice",
    range: "Level 2 - 1100",
    summary: "Balanced reading",
    tone: "blue",
  },
  {
    icon: Bot,
    name: "Expert",
    range: "Level 5 - 1700",
    summary: "Sharp tactics",
    tone: "purple",
    selected: true,
  },
  {
    icon: Bot,
    name: "Master",
    range: "Level 8 - 2300",
    summary: "Tournament strength",
    tone: "brass",
  },
] as const satisfies Difficulty[];

const guideLevels = [
  ["Beginner", "Calm and predictable. Great for learning basics.", "1 - 800", "mint"],
  ["Apprentice", "Balanced opponent with good reading.", "801 - 1200", "blue"],
  ["Expert", "Sharp tactics and strong midgame play.", "1201 - 1800", "purple"],
  ["Master", "Tournament-level AI. For advanced players.", "1801 - 2300", "brass"],
] as const satisfies ReadonlyArray<readonly [string, string, string, DifficultyTone]>;

const opponentTraits = [
  [Sparkles, "Opening Style", "Flexible"],
  [Crosshair, "Midgame", "Tactical"],
  [Trophy, "Endgame", "Precise"],
  [Target, "Favorite Pattern", "Double Threats"],
] as const satisfies ReadonlyArray<readonly [LucideIcon, string, string]>;

const aiStats = [
  ["Accuracy", "88%", 8],
  ["Aggression", "72%", 6],
  ["Defense", "82%", 7],
] as const;

const trainingRows = [
  ["Expert (1700)", "Win", "162", "May 14, 2025", "Black - 10 min"],
  ["Apprentice (1100)", "Win", "128", "May 13, 2025", "White - 10 min"],
  ["Beginner (800)", "Win", "96", "May 12, 2025", "Black - 10 min"],
] as const;

const sessionSummary = [
  { icon: Bot, label: "Mode", value: "AI Match" },
  { icon: Radio, label: "Rules", value: "15 x 15 / Standard" },
  { icon: Circle, label: "Player Color", value: "Black" },
  { icon: Clock3, label: "Time Control", value: "10 min" },
  { icon: Lightbulb, label: "Hints", value: "Enabled" },
  { icon: ShieldCheck, label: "Rating Impact", value: "Practice only" },
] as const;

const previewStones: Array<{ color: "black" | "white"; x: number; y: number }> = [
  { color: "black", x: 7, y: 7 },
  { color: "white", x: 8, y: 7 },
];

const coordinates = Array.from({ length: 15 }, (_, index) => index + 1);

const toneClasses = {
  blue: {
    border: "border-[#67b7ff]/45",
    icon: "border-[#67b7ff]/35 bg-[#67b7ff]/12 text-[#67b7ff]",
  },
  brass: {
    border: "border-[var(--brass)]/45",
    icon: "border-[var(--brass)]/35 bg-[var(--brass-soft)] text-[var(--brass)]",
  },
  mint: {
    border: "border-[var(--mint)]/45",
    icon: "border-[var(--mint)]/35 bg-[var(--mint-soft)] text-[var(--mint)]",
  },
  purple: {
    border: "border-[#b78cff]/55",
    icon: "border-[#b78cff]/35 bg-[#b78cff]/12 text-[#b78cff]",
  },
} as const;

export default function GamePage() {
  return (
    <PageShell className="py-3 xl:py-4">
      <h1 className="sr-only">AI training lobby</h1>

      <section className="command-panel mb-4 px-5 py-3 xl:px-6">
        <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-start">
          <div className="min-w-0">
            <p className="eyebrow">AI Training Lobby</p>
            <h2 className="page-title !max-w-none text-[3.15rem] xl:text-[3.55rem]">
              Choose your opponent.
            </h2>
            <p className="lede mt-2 max-w-3xl">
              Tune the challenge before the first stone is placed.
            </p>
          </div>

          <div className="inline-flex w-fit max-w-full overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1">
            {["Setup", "Analysis", "History"].map((item, index) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "min-h-10 min-w-32 rounded-sm px-4 text-sm font-black",
                  index === 0
                    ? "bg-[var(--mint-soft)] text-[var(--mint)]"
                    : "text-[var(--muted-text)] hover:bg-white/[0.05] hover:text-[var(--text)]",
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-subtle m-0 min-h-11 px-4">
            <BookOpen aria-hidden="true" className="size-4" />
            Training Rules
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)] 2xl:grid-cols-[348px_minmax(0,1fr)_390px]">
        <aside className="grid content-start gap-5">
          <Surface className="!gap-3 !p-4" eyebrow="Match setup">
            <div>
              <p className="label">Difficulty</p>
              <div className="grid gap-2">
                {difficulties.map((difficulty) => {
                  const Icon = difficulty.icon;
                  const tone = toneClasses[difficulty.tone];

                  return (
                    <button
                      key={difficulty.name}
                      type="button"
                      className={cn(
                        "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-white/[0.025] px-3 py-1.5 text-left transition hover:bg-white/[0.055]",
                        difficulty.selected
                          ? "border-[var(--mint)]/65 bg-[var(--mint-soft)] shadow-[inset_3px_0_0_var(--brass)]"
                          : "border-[var(--panel-border-soft)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-md border",
                          tone.icon,
                        )}
                      >
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-black">{difficulty.name}</span>
                        <span className="block truncate text-xs font-bold text-[var(--muted-text)]">
                          {difficulty.summary}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs font-black text-[var(--muted-strong)] tabular-nums">
                        {difficulty.range}
                        {difficulty.selected ? (
                          <span className="grid size-5 place-items-center rounded-full bg-[var(--text)] text-[var(--panel-solid)]">
                            <Check aria-hidden="true" className="size-3" />
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <SetupSelect label="Rules" value="15 x 15 / Standard" />

            <div>
              <p className="label">Player color</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="grid min-h-11 grid-cols-[auto_1fr] items-center justify-center gap-2 rounded-md border border-[var(--mint)]/45 bg-[var(--mint-soft)] px-3 text-sm font-black"
                >
                  <span className="stone stone-black size-4" aria-hidden="true" />
                  Black
                </button>
                <button
                  type="button"
                  className="grid min-h-11 grid-cols-[auto_1fr] items-center justify-center gap-2 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025] px-3 text-sm font-black text-[var(--muted-strong)] hover:bg-white/[0.055]"
                >
                  <span className="stone stone-white size-4" aria-hidden="true" />
                  White
                </button>
              </div>
            </div>

            <SetupSelect icon={Clock3} label="Time control" value="10 min" />

            <div className="flex items-center justify-between gap-3">
              <p className="label m-0">Show AI hints</p>
              <button
                type="button"
                className="relative h-7 w-12 rounded-full border border-[var(--mint)]/35 bg-[var(--mint)]/70 shadow-[0_0_18px_rgb(118_225_138_/_18%)]"
                aria-pressed="true"
                aria-label="Show AI hints enabled"
              >
                <span className="absolute top-1 right-1 size-5 rounded-full bg-[var(--text)] shadow-[0_2px_8px_rgb(0_0_0_/_35%)]" />
              </button>
            </div>

            <button type="button" className="btn btn-primary m-0 min-h-12 w-full text-base">
              <Swords aria-hidden="true" className="size-5" />
              Start Training
            </button>

            <p className="m-0 flex items-center gap-2 border-t border-[var(--panel-border-soft)] pt-3 text-sm font-bold text-[var(--muted-text)]">
              <Lightbulb aria-hidden="true" className="size-4 text-[var(--brass)]" />
              Tip: AI matches are private and unrated.
            </p>
          </Surface>
        </aside>

        <div className="grid min-w-0 gap-5">
          <Surface className="!gap-3 !p-3" eyebrow="Opponent preview">
            <div className="grid gap-3 xl:grid-cols-[minmax(235px,0.58fr)_minmax(286px,1fr)]">
              <div className="grid content-start gap-3">
                <div className="flex items-center gap-4">
                  <span className="grid size-16 shrink-0 place-items-center rounded-full border border-[var(--mint)]/35 bg-[var(--mint-soft)] shadow-[0_0_42px_rgb(118_225_138_/_12%)]">
                    <BrainCircuit aria-hidden="true" className="size-8 text-[var(--mint)]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="m-0 truncate text-2xl font-black">Kata Reader</h2>
                      <span
                        className="size-2.5 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="m-0 text-sm font-bold text-[var(--muted-strong)]">
                      Level 5 / 1724
                    </p>
                    <Badge tone="brass">
                      <Gauge aria-hidden="true" className="size-3.5" />
                      Strong AI
                    </Badge>
                  </div>
                </div>

                <div className="split-line" />

                <div>
                  <p className="label">Strengths</p>
                  <div className="grid gap-1.5 text-sm font-bold text-[var(--muted-strong)]">
                    {[
                      "Reads forcing lines",
                      "Punishes open threes",
                      "Strong in midgame fights",
                    ].map((strength) => (
                      <p key={strength} className="m-0 flex items-center gap-2">
                        <span
                          className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]"
                          aria-hidden="true"
                        />
                        {strength}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  {aiStats.map(([label, value, bars]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[88px_minmax(0,1fr)_42px] items-center gap-3"
                    >
                      <span className="text-sm font-bold text-[var(--muted-text)]">{label}</span>
                      <span className="grid grid-cols-8 gap-1">
                        {Array.from({ length: 8 }, (_, index) => (
                          <span
                            key={index}
                            className={cn(
                              "h-3 rounded-sm",
                              index < bars ? "bg-[var(--mint)]/80" : "bg-white/[0.09]",
                            )}
                          />
                        ))}
                      </span>
                      <span className="text-right text-sm font-black tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>

                <blockquote className="m-0 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-2.5 text-sm leading-6 font-bold text-[var(--muted-strong)]">
                  "A well-balanced opponent with sharp tactics and solid positional play."
                </blockquote>
              </div>

              <BoardPreview />
            </div>

            <div className="grid gap-2 rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-2.5 sm:grid-cols-4">
              {opponentTraits.map(([Icon, label, value]) => (
                <div
                  key={label as string}
                  className="grid gap-1 border-b border-[var(--panel-border-soft)] pb-2 last:border-b-0 sm:border-r sm:border-b-0 sm:pb-0 sm:last:border-r-0"
                >
                  <Icon aria-hidden="true" className="size-5 text-[var(--brass)]" />
                  <span className="text-xs font-bold text-[var(--muted-text)]">{label}</span>
                  <span className="text-sm font-black">{value}</span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="!gap-2 !p-3" eyebrow="Recent AI training">
            <div className="overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[1.2fr_0.6fr_0.6fr_0.9fr_1fr_auto] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-2 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
                  <span>Level</span>
                  <span>Result</span>
                  <span>Moves</span>
                  <span>Date</span>
                  <span>Notes</span>
                  <span />
                </div>
                {trainingRows.map(([level, result, moves, date, notes]) => (
                  <div
                    key={`${level}-${date}`}
                    className="grid min-h-10 grid-cols-[1.2fr_0.6fr_0.6fr_0.9fr_1fr_auto] items-center gap-3 border-b border-[var(--panel-border-soft)] px-4 py-1.5 text-sm last:border-b-0 hover:bg-white/[0.045]"
                  >
                    <span className="font-black">{level}</span>
                    <span className="font-black text-[var(--mint)]">{result}</span>
                    <span className="font-bold text-[var(--muted-strong)] tabular-nums">
                      {moves}
                    </span>
                    <span className="font-bold text-[var(--muted-text)]">{date}</span>
                    <span className="font-bold text-[var(--muted-strong)]">{notes}</span>
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-full border border-[var(--brass)]/40 text-[var(--brass)] hover:bg-[var(--brass-soft)]"
                      aria-label={`Review ${level} training from ${date}`}
                    >
                      <Play aria-hidden="true" className="size-3.5 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Surface>
        </div>

        <aside className="grid content-start gap-5 xl:grid-cols-2 2xl:grid-cols-1">
          <Surface className="!gap-2 !p-3" eyebrow="Difficulty guide">
            <div className="grid gap-2">
              {guideLevels.map(([name, description, range, tone]) => {
                const colors = toneClasses[tone];
                return (
                  <article
                    key={name}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-white/[0.025] p-2.5",
                      name === "Expert" ? colors.border : "border-[var(--panel-border-soft)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-md border",
                        colors.icon,
                      )}
                    >
                      <Bot aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-black">{name}</span>
                      <span className="block text-sm leading-5 text-[var(--muted-text)]">
                        {description}
                      </span>
                    </span>
                    <span className="text-sm font-black text-[var(--muted-strong)] tabular-nums">
                      {range}
                    </span>
                  </article>
                );
              })}
            </div>
          </Surface>

          <Surface className="!gap-2 !p-3" eyebrow="Session summary">
            <div className="grid gap-3 text-sm">
              {sessionSummary.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--panel-border-soft)] pb-3 last:border-b-0 last:pb-0"
                  >
                    <Icon aria-hidden="true" className="size-4 text-[var(--brass)]" />
                    <span className="font-bold text-[var(--muted-text)]">{item.label}</span>
                    <span className="text-right font-black">{item.value}</span>
                  </div>
                );
              })}
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--panel-border-soft)] pt-3">
                <Info aria-hidden="true" className="size-4 text-[var(--brass)]" />
                <span className="font-bold text-[var(--muted-text)]">Status</span>
                <span className="flex items-center justify-end gap-2 font-black text-[var(--mint)]">
                  <span
                    className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]"
                    aria-hidden="true"
                  />
                  Ready
                </span>
              </div>
            </div>
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}

function SetupSelect({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <button
        type="button"
        className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] px-3 text-left font-black hover:bg-[var(--panel-hover)]"
      >
        {Icon ? <Icon aria-hidden="true" className="size-4 text-[var(--muted-text)]" /> : null}
        <span className="truncate">{value}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-[var(--muted-text)]" />
      </button>
    </div>
  );
}

function BoardPreview() {
  return (
    <div className="rounded-md border border-[var(--brass)]/30 bg-[var(--panel-solid)] p-3 shadow-[0_22px_60px_rgb(0_0_0_/_34%)]">
      <div className="relative mx-auto max-w-[292px] pt-4 pl-5">
        <div className="absolute top-0 right-1 left-7 grid grid-cols-[repeat(15,minmax(0,1fr))] text-center text-[0.62rem] font-black text-[#6f3e1b] tabular-nums">
          {coordinates.map((coordinate) => (
            <span key={coordinate}>{coordinate}</span>
          ))}
        </div>
        <div className="absolute top-7 bottom-12 left-0 grid grid-rows-[repeat(15,minmax(0,1fr))] text-center text-[0.62rem] font-black text-[#6f3e1b] tabular-nums">
          {coordinates.map((coordinate) => (
            <span key={coordinate}>{coordinate}</span>
          ))}
        </div>
        <GomokuBoard stones={previewStones} className="w-full shadow-none" />
      </div>
      <p className="m-0 mt-3 flex items-center gap-2 text-xs font-bold text-[var(--muted-text)]">
        <span className="size-2 rounded-full bg-[var(--brass)]" aria-hidden="true" />
        Opening preview only. No match has started.
      </p>
    </div>
  );
}
