"use client";

import {
  Bot,
  BrainCircuit,
  Check,
  Circle,
  Clock3,
  Crosshair,
  Gauge,
  Info,
  Lightbulb,
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

function getErrorMessage(payload: ErrorResponse | null, fallback: string) {
  return payload?.message ?? payload?.detail ?? payload?.error ?? fallback;
}

function getStoredRole(role: string | undefined): StoredMatchSession["role"] {
  return role === "SPECTATOR" ? "SPECTATOR" : "PLAYER";
}

function isSeat(value: unknown): value is Seat | null {
  return value === "BLACK" || value === "WHITE" || value === null;
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
      strengths: selectedDifficulty.strengthIds.map((strengthId) =>
        t(`difficulty.strengths.${id}.${strengthId}`),
      ),
      traits: selectedDifficulty.traits.map((trait) => ({
        ...trait,
        label: t(`difficulty.traitLabels.${trait.labelId}`),
        value: t(`difficulty.traitValues.${trait.valueId}`),
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
    [playerSeat, showHints, t, translatedSelectedDifficulty.name],
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
  }, [handleSessionReady, playerSeat, selectedDifficultyId, t]);

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
        <div className="relative z-10 grid gap-5 xl:items-start">
          <div className="min-w-0">
            <p className="eyebrow">{t("hero.eyebrow")}</p>
            <h1 className="page-title !max-w-none text-[3.15rem] xl:text-[3.55rem]">
              {t("hero.title")}
            </h1>
            <p className="lede mt-2 max-w-3xl">{t("hero.lede")}</p>
          </div>
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
                      <span className="flex items-center justify-end gap-2 text-xs font-black text-[var(--muted-strong)]">
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

            <SetupReadout label={t("setup.rulesLabel")} value={t("setup.rulesValue")} />

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

            <SetupReadout
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
                        <span translate="no">{t("preview.title")}</span>
                      </h2>
                      <span
                        className="size-2.5 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]"
                        aria-hidden="true"
                      />
                    </div>
                    <Badge tone="brass">
                      <Gauge aria-hidden="true" className="size-3.5" />
                      {t("preview.difficultyBadge", {
                        difficulty: translatedSelectedDifficulty.name,
                      })}
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

                <blockquote className="m-0 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-2.5 text-sm leading-6 font-bold text-[var(--muted-strong)]">
                  &ldquo;{translatedSelectedDifficulty.description}&rdquo;
                </blockquote>
              </div>

              <BoardPreview openingPreview={t("preview.openingPreview")} />
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
                    <span className="text-sm font-black">{trait.value}</span>
                  </div>
                );
              })}
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
                      "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border bg-white/[0.025] p-2.5",
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

function SetupReadout({
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
      <div
        className={cn(
          "grid min-h-11 w-full items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] px-3 font-black",
          Icon ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)]",
        )}
      >
        {Icon ? <Icon aria-hidden="true" className="size-4 text-[var(--muted-text)]" /> : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function BoardPreview({ openingPreview }: { openingPreview: string }) {
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
        {openingPreview}
      </p>
    </div>
  );
}
