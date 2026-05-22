"use client";

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
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import AiMatchRoom from "@/components/ai-match-room";
import GomokuBoard from "@/components/gomoku-board";
import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { useMatchInitialize } from "@/hooks/useMatchInitialize";
import {
  aiDifficultyOptions,
  defaultAiDifficultyId,
  getAiDifficulty,
  type AiDifficultyId,
  type AiDifficultyTone,
} from "@/lib/matches/ai-difficulty";
import {
  saveStoredMatchSession,
  type StoredMatchSession,
} from "@/lib/matches/match-session-storage";
import { cn } from "@/lib/utils";

import type { Seat } from "../../shared/match-events";

type SoloMatchResponse = {
  difficulty?: AiDifficultyId;
  matchId?: string;
  participantId?: string;
  role?: string;
  seat?: Seat | null;
};

type ErrorResponse = {
  detail?: string;
  error?: string;
  message?: string;
};

const previewStones: Array<{ color: "black" | "white"; x: number; y: number }> = [
  { color: "black", x: 7, y: 7 },
  { color: "white", x: 8, y: 7 },
];

const coordinates = Array.from({ length: 15 }, (_, index) => index + 1);
const opponentTraitIcons = [Sparkles, Crosshair, Trophy, Target] as const;

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
} as const satisfies Record<AiDifficultyTone, { border: string; icon: string }>;

const trainingRows = [
  ["Expert (1700)", "Win", "162", "May 14, 2026", "Black - private"],
  ["Apprentice (1100)", "Win", "128", "May 13, 2026", "White - private"],
  ["Beginner (800)", "Win", "96", "May 12, 2026", "Black - private"],
] as const;

function getErrorMessage(payload: ErrorResponse | null, fallback: string) {
  return payload?.message ?? payload?.detail ?? payload?.error ?? fallback;
}

function getStoredRole(role: string | undefined): StoredMatchSession["role"] {
  return role === "SPECTATOR" ? "SPECTATOR" : "PLAYER";
}

function isSeat(value: unknown): value is Seat | null {
  return value === "BLACK" || value === "WHITE" || value === null;
}

function getDifficultyStatLabel(t: ReturnType<typeof useTranslations>, label: string) {
  switch (label) {
    case "Accuracy":
      return t("difficulty.statLabels.accuracy");
    case "Aggression":
      return t("difficulty.statLabels.aggression");
    case "Defense":
      return t("difficulty.statLabels.defense");
    default:
      return label;
  }
}

function getDifficultyTraitValue(t: ReturnType<typeof useTranslations>, value: string) {
  switch (value) {
    case "Centered":
      return t("difficulty.traitValues.centered");
    case "Local":
      return t("difficulty.traitValues.local");
    case "Uneven":
      return t("difficulty.traitValues.uneven");
    case "Open twos":
      return t("difficulty.traitValues.openTwos");
    case "Open threes":
      return t("difficulty.traitValues.openThrees");
    case "Balanced":
      return t("difficulty.traitValues.balanced");
    case "Careful":
      return t("difficulty.traitValues.careful");
    case "Pressure":
      return t("difficulty.traitValues.pressure");
    case "Forcing":
      return t("difficulty.traitValues.forcing");
    case "Clinical":
      return t("difficulty.traitValues.clinical");
    case "Fork threats":
      return t("difficulty.traitValues.forkThreats");
    case "Flexible":
      return t("difficulty.traitValues.flexible");
    case "Tactical":
      return t("difficulty.traitValues.tactical");
    case "Precise":
      return t("difficulty.traitValues.precise");
    case "Double threats":
      return t("difficulty.traitValues.doubleThreats");
    default:
      return value;
  }
}

export default function AiLobbyClient() {
  const t = useTranslations("aiLobby");
  const restoredMatch = useMatchInitialize();
  const setRestoredSession = restoredMatch.setSession;
  const [selectedDifficultyId, setSelectedDifficultyId] =
    useState<AiDifficultyId>(defaultAiDifficultyId);
  const [playerSeat, setPlayerSeat] = useState<Seat>("BLACK");
  const [showHints, setShowHints] = useState(true);
  const [activeSession, setActiveSession] = useState<StoredMatchSession | null>(null);
  const [showLobby, setShowLobby] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const selectedDifficulty = getAiDifficulty(selectedDifficultyId);

  const translatedSelectedDifficulty = useMemo(() => {
    const id = selectedDifficulty.id;
    return {
      ...selectedDifficulty,
      name: t(`difficulty.names.${id}`),
      summary: t(`difficulty.summaries.${id}`),
      description: t(`difficulty.descriptions.${id}`),
      strengths: selectedDifficulty.strengths.map((_, idx) =>
        t(`difficulty.strengths.${id}.${idx}`),
      ),
      traits: selectedDifficulty.traits.map((trait, idx) => ({
        ...trait,
        label: t(`difficulty.traits.${id}.${idx}.label`),
      })),
    };
  }, [selectedDifficulty, t]);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (showLobby || !restoredMatch.session) {
      return;
    }

    const restoredIsAi = restoredMatch.session.mode === "ai" || restoredMatch.state?.mode === "ai";

    if (restoredIsAi) {
      setActiveSession(restoredMatch.session);
    }
  }, [restoredMatch.session, restoredMatch.state, showLobby]);

  const sessionSummary = useMemo(
    () => [
      { icon: Bot, label: t("summary.modeLabel"), value: t("summary.modeValue") },
      { icon: Radio, label: t("summary.rulesLabel"), value: t("summary.rulesValue") },
      {
        icon: Circle,
        label: t("summary.playerColorLabel"),
        value: playerSeat === "BLACK" ? t("seat.black") : t("seat.white"),
      },
      {
        icon: Gauge,
        label: t("summary.difficultyLabel"),
        value: translatedSelectedDifficulty.name,
      },
      {
        icon: Lightbulb,
        label: t("summary.hintsLabel"),
        value: showHints ? t("summary.hintsEnabled") : t("summary.hintsHidden"),
      },
      {
        icon: ShieldCheck,
        label: t("summary.ratingImpactLabel"),
        value: t("summary.ratingImpactValue"),
      },
    ],
    [playerSeat, selectedDifficulty.name, showHints, t],
  );

  const handleSessionReady = useCallback(
    (session: StoredMatchSession) => {
      setRestoredSession(session);
      setShowLobby(false);
      setActiveSession(session);
    },
    [setRestoredSession],
  );

  const handleStartTraining = useCallback(async () => {
    setIsStarting(true);
    setStartError(null);

    try {
      const response = await fetch("/api/matches/solo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          difficulty: selectedDifficultyId,
          playerSeat,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        setStartError(
          getErrorMessage(
            errorPayload,
            t("errors.soloMatchRequestFailed", { status: response.status }),
          ),
        );
        return;
      }

      const result = (await response.json()) as SoloMatchResponse;

      if (!result.matchId || !result.participantId) {
        setStartError(t("errors.missingSoloMatchSession"));
        return;
      }

      const storedSession: StoredMatchSession = {
        aiDifficulty: result.difficulty ?? selectedDifficultyId,
        displayName: "Player",
        matchId: result.matchId,
        mode: "ai",
        participantId: result.participantId,
        role: getStoredRole(result.role),
        seat: isSeat(result.seat) ? result.seat : playerSeat,
      };

      saveStoredMatchSession(storedSession);
      handleSessionReady(storedSession);
    } catch {
      setStartError(t("errors.networkStartSoloMatch"));
    } finally {
      setIsStarting(false);
    }
  }, [handleSessionReady, playerSeat, selectedDifficultyId]);

  const handleBackToLobby = useCallback(() => {
    setShowLobby(true);
    setActiveSession(null);
  }, []);

  const handleSessionLost = useCallback(() => {
    setRestoredSession(null);
    setActiveSession(null);
    setShowLobby(true);
  }, [setRestoredSession]);

  if (activeSession) {
    return (
      <AiMatchRoom
        initialState={restoredMatch.state}
        isRestoring={restoredMatch.isLoading}
        onBackToLobbyAction={handleBackToLobby}
        onSessionLostAction={handleSessionLost}
        restoreError={restoredMatch.error}
        session={activeSession}
      />
    );
  }

  if (restoredMatch.isLoading && restoredMatch.session?.mode === "ai" && !showLobby) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={t("loading.eyebrow")}
          icon={Swords}
          title={t("loading.title")}
          lede={t("loading.lede")}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="py-3 xl:py-4">
      <section className="command-panel mb-4 px-5 py-3 xl:px-6">
        <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-start">
          <div className="min-w-0">
            <p className="eyebrow">{t("hero.eyebrow")}</p>
            <h1 className="page-title !max-w-none text-[3.15rem] xl:text-[3.55rem]">
              {t("hero.title")}
            </h1>
            <p className="lede mt-2 max-w-3xl">{t("hero.lede")}</p>
          </div>

          <div className="inline-flex w-fit max-w-full overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1">
            {[t("tabs.setup"), t("tabs.analysis"), t("tabs.history")].map((item, index) => (
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
            {t("hero.rulesButton")}
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)] 2xl:grid-cols-[348px_minmax(0,1fr)_390px]">
        <aside className="grid content-start gap-5">
          <Surface className="!gap-3 !p-4" eyebrow={t("setup.eyebrow")}>
            <div>
              <p className="label">{t("setup.difficultyLabel")}</p>
              <div className="grid gap-2">
                {aiDifficultyOptions.map((difficulty) => {
                  const tone = toneClasses[difficulty.tone];
                  const selected = difficulty.id === selectedDifficultyId;

                  return (
                    <button
                      key={difficulty.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedDifficultyId(difficulty.id)}
                      className={cn(
                        "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-white/[0.025] px-3 py-1.5 text-left transition hover:bg-white/[0.055]",
                        selected
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
                        <Bot aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-black">
                          {t(`difficulty.names.${difficulty.id}`)}
                        </span>
                        <span className="block truncate text-xs font-bold text-[var(--muted-text)]">
                          {t(`difficulty.summaries.${difficulty.id}`)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs font-black text-[var(--muted-strong)] tabular-nums">
                        {difficulty.range}
                        {selected ? (
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

            <SetupSelect label={t("setup.rulesLabel")} value={t("setup.rulesValue")} />

            <div>
              <p className="label">{t("setup.playerColorLabel")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["BLACK", "WHITE"] as const).map((seat) => (
                  <button
                    key={seat}
                    type="button"
                    aria-pressed={playerSeat === seat}
                    onClick={() => setPlayerSeat(seat)}
                    className={cn(
                      "grid min-h-11 grid-cols-[auto_1fr] items-center justify-center gap-2 rounded-md border px-3 text-sm font-black",
                      playerSeat === seat
                        ? "border-[var(--mint)]/45 bg-[var(--mint-soft)]"
                        : "border-[var(--panel-border-soft)] bg-white/[0.025] text-[var(--muted-strong)] hover:bg-white/[0.055]",
                    )}
                  >
                    <span
                      className={cn(
                        "stone size-4",
                        seat === "BLACK" ? "stone-black" : "stone-white",
                      )}
                      aria-hidden="true"
                    />
                    {seat === "BLACK" ? t("seat.black") : t("seat.white")}
                  </button>
                ))}
              </div>
            </div>

            <SetupSelect
              icon={Clock3}
              label={t("setup.timeControlLabel")}
              value={t("setup.timeControlValue")}
            />

            <div className="flex items-center justify-between gap-3">
              <p className="label m-0">{t("setup.showHintsLabel")}</p>
              <button
                type="button"
                className={cn(
                  "relative h-7 w-12 rounded-full border shadow-[0_0_18px_rgb(118_225_138_/_18%)]",
                  showHints
                    ? "border-[var(--mint)]/35 bg-[var(--mint)]/70"
                    : "border-[var(--panel-border-soft)] bg-white/[0.08]",
                )}
                aria-pressed={showHints}
                aria-label={showHints ? t("setup.showHintsEnabled") : t("setup.showHintsDisabled")}
                onClick={() => setShowHints((value) => !value)}
              >
                <span
                  className={cn(
                    "absolute top-1 size-5 rounded-full bg-[var(--text)] shadow-[0_2px_8px_rgb(0_0_0_/_35%)] transition-[left,right]",
                    showHints ? "right-1" : "left-1",
                  )}
                />
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary m-0 min-h-12 w-full text-base"
              onClick={() => {
                void handleStartTraining();
              }}
              disabled={!isClientReady || isStarting}
              aria-busy={isStarting}
            >
              <Swords aria-hidden="true" className="size-5" />
              {isStarting ? t("setup.startingButton") : t("setup.startButton")}
            </button>

            {startError ? (
              <p role="alert" className="m-0 text-sm font-bold text-[var(--danger)]">
                {startError}
              </p>
            ) : null}

            <p className="m-0 flex items-center gap-2 border-t border-[var(--panel-border-soft)] pt-3 text-sm font-bold text-[var(--muted-text)]">
              <Lightbulb aria-hidden="true" className="size-4 text-[var(--brass)]" />
              {t("setup.tip")}
            </p>
          </Surface>
        </aside>

        <div className="grid min-w-0 gap-5">
          <Surface className="!gap-3 !p-3" eyebrow={t("preview.eyebrow")}>
            <div className="grid gap-3 xl:grid-cols-[minmax(235px,0.58fr)_minmax(286px,1fr)]">
              <div className="grid content-start gap-3">
                <div className="flex items-center gap-4">
                  <span className="grid size-16 shrink-0 place-items-center rounded-full border border-[var(--mint)]/35 bg-[var(--mint-soft)] shadow-[0_0_42px_rgb(118_225_138_/_12%)]">
                    <BrainCircuit aria-hidden="true" className="size-8 text-[var(--mint)]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="m-0 truncate text-2xl font-black">
                        {t("preview.title").toString()}
                      </h2>
                      <span
                        className="size-2.5 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="m-0 text-sm font-bold text-[var(--muted-strong)]">
                      {selectedDifficulty.range}
                    </p>
                    <Badge tone="brass">
                      <Gauge aria-hidden="true" className="size-3.5" />
                      {translatedSelectedDifficulty.name} AI
                    </Badge>
                  </div>
                </div>

                <div className="split-line" />

                <div>
                  <p className="label">{t("preview.strengthsLabel")}</p>
                  <div className="grid gap-1.5 text-sm font-bold text-[var(--muted-strong)]">
                    {translatedSelectedDifficulty.strengths.map((strength, index) => (
                      <p key={index} className="m-0 flex items-center gap-2">
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
                  {selectedDifficulty.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="grid grid-cols-[88px_minmax(0,1fr)_42px] items-center gap-3"
                    >
                      <span className="text-sm font-bold text-[var(--muted-text)]">
                        {getDifficultyStatLabel(t, stat.label)}
                      </span>
                      <span className="grid grid-cols-8 gap-1">
                        {Array.from({ length: 8 }, (_, index) => (
                          <span
                            key={index}
                            className={cn(
                              "h-3 rounded-sm",
                              index < stat.bars ? "bg-[var(--mint)]/80" : "bg-white/[0.09]",
                            )}
                          />
                        ))}
                      </span>
                      <span className="text-right text-sm font-black tabular-nums">
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>

                <blockquote className="m-0 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-2.5 text-sm leading-6 font-bold text-[var(--muted-strong)]">
                  "{translatedSelectedDifficulty.description}"
                </blockquote>
              </div>

              <BoardPreview />
            </div>

            <div className="grid gap-2 rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-2.5 sm:grid-cols-4">
              {translatedSelectedDifficulty.traits.map((trait, index) => {
                const Icon = opponentTraitIcons[index] ?? Sparkles;
                return (
                  <div
                    key={index}
                    className="grid gap-1 border-b border-[var(--panel-border-soft)] pb-2 last:border-b-0 sm:border-r sm:border-b-0 sm:pb-0 sm:last:border-r-0"
                  >
                    <Icon aria-hidden="true" className="size-5 text-[var(--brass)]" />
                    <span className="text-xs font-bold text-[var(--muted-text)]">
                      {trait.label}
                    </span>
                    <span className="text-sm font-black">
                      {getDifficultyTraitValue(t, trait.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Surface>

          <Surface className="!gap-2 !p-3" eyebrow={t("training.eyebrow")}>
            <div className="overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-white/[0.025]">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[1.2fr_0.6fr_0.6fr_0.9fr_1fr_auto] gap-3 border-b border-[var(--panel-border-soft)] bg-black/20 px-4 py-2 text-xs font-black tracking-[0.12em] text-[var(--muted-text)] uppercase">
                  <span>{t("training.headers.level")}</span>
                  <span>{t("training.headers.result")}</span>
                  <span>{t("training.headers.moves")}</span>
                  <span>{t("training.headers.date")}</span>
                  <span>{t("training.headers.notes")}</span>
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
                      aria-label={t("training.reviewAria", { level, date })}
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
          <Surface className="!gap-2 !p-3" eyebrow={t("difficultyGuide.eyebrow")}>
            <div className="grid gap-2">
              {aiDifficultyOptions.map((difficulty) => {
                const colors = toneClasses[difficulty.tone];
                return (
                  <article
                    key={difficulty.id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-white/[0.025] p-2.5",
                      difficulty.id === selectedDifficultyId
                        ? colors.border
                        : "border-[var(--panel-border-soft)]",
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
                      <span className="block truncate font-black">
                        {t(`difficulty.names.${difficulty.id}`)}
                      </span>
                      <span className="block text-sm leading-5 text-[var(--muted-text)]">
                        {t(`difficulty.descriptions.${difficulty.id}`)}
                      </span>
                    </span>
                    <span className="text-sm font-black text-[var(--muted-strong)] tabular-nums">
                      {difficulty.range}
                    </span>
                  </article>
                );
              })}
            </div>
          </Surface>

          <Surface className="!gap-2 !p-3" eyebrow={t("summary.eyebrow")}>
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
                <span className="font-bold text-[var(--muted-text)]">
                  {t("summary.statusLabel")}
                </span>
                <span className="flex items-center justify-end gap-2 font-black text-[var(--mint)]">
                  <span
                    className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]"
                    aria-hidden="true"
                  />
                  {t("summary.readyValue")}
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
