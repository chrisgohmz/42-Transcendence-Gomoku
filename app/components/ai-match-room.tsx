"use client";

import { ArrowLeft, CircleDot, Flag, LoaderCircle, RefreshCcw, Swords } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import MatchBoard, { formatBoardPoint } from "@/components/match-board";
import PlayerBar from "@/components/player-bar";
import { useSocketGame } from "@/hooks/useSocketGame";
import { getAiDifficulty } from "@/lib/matches/ai-difficulty";
import { soloAiDisplayName } from "@/lib/matches/ai-solo";
import {
  clearStoredMatchSession,
  type StoredMatchSession,
} from "@/lib/matches/match-session-storage";
import {
  getGameUpdateForSession,
  getSessionSeat,
  selectLatestGameUpdateForSession,
  toInitialGameUpdate,
  type MatchStateResponse,
} from "@/lib/matches/match-state";
import { MoveSubmissionError, submitMove } from "@/lib/matches/submit-move";
import { cn } from "@/lib/utils";

import type { Cell, GameUpdatePayload, ParticipantSummary, Seat } from "../../shared/match-events";

type Translator = (key: string, values?: Record<string, string | number>) => string;

type AiMatchRoomProps = {
  initialState: MatchStateResponse | null;
  isRestoring?: boolean;
  onBackToLobbyAction: () => void;
  onSessionLostAction: () => void;
  restoreError?: string | null;
  session: StoredMatchSession;
};

type MatchMove = MatchStateResponse["moves"][number];

function emptyBoard(boardSize: number): Cell[][] {
  return Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => ({ occupied: false }) as Cell),
  );
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const errorPayload = payload as { detail?: unknown; error?: unknown; message?: unknown };
  return (
    [errorPayload.message, errorPayload.detail, errorPayload.error].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    ) ?? fallback
  );
}

function getErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const errorPayload = payload as { error?: unknown };
  return typeof errorPayload.error === "string" ? errorPayload.error : null;
}

function oppositeSeat(seat: Seat | null): Seat | null {
  if (seat === "BLACK") {
    return "WHITE";
  }

  return seat === "WHITE" ? "BLACK" : null;
}

function statusTone(status: GameUpdatePayload["status"] | undefined): "brass" | "mint" | "red" {
  if (status === "IN_PROGRESS") {
    return "mint";
  }

  if (status === "FINISHED" || status === "WAITING") {
    return "brass";
  }

  return "red";
}

export default function AiMatchRoom({
  initialState,
  isRestoring = false,
  onBackToLobbyAction,
  onSessionLostAction,
  restoreError,
  session,
}: AiMatchRoomProps) {
  const t = useTranslations("aiLobby.matchRoom");
  const tAiLobby = useTranslations("aiLobby");
  const [state, setState] = useState<MatchStateResponse | null>(
    initialState?.matchId === session.matchId ? initialState : null,
  );
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(restoreError ?? null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [aiLastReason, setAiLastReason] = useState<string | null>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [failedAiTurnVersion, setFailedAiTurnVersion] = useState<number | null>(null);
  const [isResigning, setIsResigning] = useState(false);
  const requestedAiVersionRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialState?.matchId === session.matchId) {
      setState(initialState);
    }
  }, [initialState, session.matchId]);

  const loadState = useCallback(async () => {
    setIsLoadingState(true);
    setLoadError(null);

    try {
      const searchParams = new URLSearchParams({
        participantId: session.participantId,
      });
      const response = await fetch(
        `/api/matches/${encodeURIComponent(session.matchId)}/state?${searchParams}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        if (response.status === 403 || response.status === 404) {
          clearStoredMatchSession(session.matchId);
          onSessionLostAction();
        }

        setLoadError(
          getErrorMessage(
            errorPayload,
            t("errors.stateRequestFailed", { status: response.status }),
          ),
        );
        return null;
      }

      const nextState = (await response.json()) as MatchStateResponse;
      setState(nextState);
      setLoadError(null);
      return nextState;
    } catch {
      setLoadError(t("errors.networkLoadState"));
      return null;
    } finally {
      setIsLoadingState(false);
    }
  }, [onSessionLostAction, session.matchId, session.participantId, t]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const initialUpdate = toInitialGameUpdate(state, session);
  const { lastUpdate } = useSocketGame(
    session.matchId,
    session.participantId,
    initialUpdate?.stateVersion ?? null,
  );
  const liveUpdate = getGameUpdateForSession(lastUpdate, session);
  const effectiveUpdate = selectLatestGameUpdateForSession(initialUpdate, liveUpdate, session);
  const board = effectiveUpdate?.board ?? state?.board ?? emptyBoard(state?.boardSize ?? 15);
  const participants = useMemo(
    () => effectiveUpdate?.participants ?? state?.participants ?? [],
    [effectiveUpdate?.participants, state?.participants],
  );
  const participantBySeat = useMemo(
    () => ({
      BLACK: participants.find((participant) => participant.seat === "BLACK") ?? null,
      WHITE: participants.find((participant) => participant.seat === "WHITE") ?? null,
    }),
    [participants],
  );
  const mySeat = getSessionSeat(state, session) ?? session.seat;
  const matchMode = effectiveUpdate?.mode ?? state?.mode ?? session.mode;
  const aiSeat = matchMode === "ai" ? oppositeSeat(mySeat) : null;
  const aiParticipant = aiSeat ? participantBySeat[aiSeat] : null;
  const aiName = aiParticipant?.displayName ?? soloAiDisplayName;
  const difficulty = getAiDifficulty(
    session.aiDifficulty ?? effectiveUpdate?.aiDifficulty ?? state?.aiDifficulty,
  );
  const difficultyName = tAiLobby(`difficulty.names.${difficulty.id}`);
  const playerName = session.displayName || t("seat.you");
  const blackName =
    participantBySeat.BLACK?.displayName ??
    (mySeat === "BLACK" ? playerName : aiSeat === "BLACK" ? aiName : t("seat.openSeat"));
  const whiteName =
    participantBySeat.WHITE?.displayName ??
    (mySeat === "WHITE" ? playerName : aiSeat === "WHITE" ? aiName : t("seat.openSeat"));
  const moveHistory = useMemo(
    () => effectiveUpdate?.moves ?? state?.moves ?? [],
    [effectiveUpdate?.moves, state?.moves],
  );
  const matchStatus = effectiveUpdate?.status ?? state?.status;
  const canResign = effectiveUpdate?.status === "IN_PROGRESS" && mySeat !== null;
  const isAiTurn =
    effectiveUpdate?.status === "IN_PROGRESS" &&
    aiSeat !== null &&
    effectiveUpdate.nextTurnSeat === aiSeat;
  const canRetryAiTurn =
    isAiTurn &&
    !isAiThinking &&
    typeof effectiveUpdate?.stateVersion === "number" &&
    failedAiTurnVersion === effectiveUpdate.stateVersion;
  const isBusy = isRestoring || isLoadingState;

  const requestAiTurn = useCallback(
    async (baseVersion: number) => {
      setIsAiThinking(true);
      setMoveError(null);

      try {
        const response = await fetch(
          `/api/matches/${encodeURIComponent(session.matchId)}/ai-turn`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              baseVersion,
              participantId: session.participantId,
            }),
          },
        );

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          const errorCode = getErrorCode(errorPayload);
          if (errorCode === "stale_state" || errorCode === "not_ai_turn") {
            setFailedAiTurnVersion(null);
            await loadState();
            return;
          }

          setMoveError(
            getErrorMessage(errorPayload, t("errors.aiTurnFailed", { status: response.status })),
          );
          setFailedAiTurnVersion(baseVersion);
          return;
        }

        const payload = (await response.json()) as { move?: { reason?: string } };
        setAiLastReason(payload.move?.reason ?? null);
        setFailedAiTurnVersion(null);
        await loadState();
      } catch {
        setMoveError(t("errors.networkAiTurn"));
        setFailedAiTurnVersion(baseVersion);
      } finally {
        setIsAiThinking(false);
      }
    },
    [loadState, session.matchId, session.participantId, t],
  );

  useEffect(() => {
    const stateVersion = effectiveUpdate?.stateVersion;
    if (
      !isAiTurn ||
      typeof stateVersion !== "number" ||
      isAiThinking ||
      failedAiTurnVersion === stateVersion
    ) {
      return;
    }

    if (requestedAiVersionRef.current === stateVersion) {
      return;
    }

    requestedAiVersionRef.current = stateVersion;
    void requestAiTurn(stateVersion);
  }, [effectiveUpdate?.stateVersion, failedAiTurnVersion, isAiThinking, isAiTurn, requestAiTurn]);

  function handleRetryAiTurn() {
    const stateVersion = effectiveUpdate?.stateVersion;
    if (!isAiTurn || typeof stateVersion !== "number" || isAiThinking) {
      return;
    }

    setFailedAiTurnVersion(null);
    requestedAiVersionRef.current = stateVersion;
    void requestAiTurn(stateVersion);
  }

  async function handleCellSelect(x: number, y: number) {
    if (!effectiveUpdate || !mySeat || effectiveUpdate.status !== "IN_PROGRESS") {
      return;
    }

    setIsSubmittingMove(true);
    setMoveError(null);
    setFailedAiTurnVersion(null);
    setAiLastReason(null);

    try {
      await submitMove({
        baseVersion: effectiveUpdate.stateVersion,
        matchId: session.matchId,
        participantId: session.participantId,
        position: { x, y },
      });
      await loadState();
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : t("errors.networkSubmitMove"));
      if (error instanceof MoveSubmissionError && error.code === "stale_state") {
        await loadState();
      }
    } finally {
      setIsSubmittingMove(false);
    }
  }

  async function handleResign() {
    if (!effectiveUpdate || !canResign || isResigning) {
      return;
    }

    setIsResigning(true);
    setMoveError(null);

    try {
      const response = await fetch(`/api/matches/${encodeURIComponent(session.matchId)}/resign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseVersion: effectiveUpdate.stateVersion,
          participantId: session.participantId,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorCode = getErrorCode(errorPayload);
        setMoveError(
          getErrorMessage(
            errorPayload,
            t("errors.resignRequestFailed", { status: response.status }),
          ),
        );
        if (errorCode === "stale_state") {
          await loadState();
        }
        return;
      }

      await loadState();
    } catch {
      setMoveError(t("errors.networkResign"));
    } finally {
      setIsResigning(false);
    }
  }

  return (
    <PageShell className="ai-match-room">
      <PageHeader
        eyebrow={t("page.eyebrow")}
        icon={Swords}
        title={matchStatus === "FINISHED" ? t("page.title.finished") : t("page.title.live")}
        lede={
          matchStatus === "FINISHED"
            ? t("page.lede.finished")
            : t("page.lede.live", { aiName, difficulty: difficultyName })
        }
        actions={
          <>
            <Badge tone={statusTone(matchStatus)}>
              <CircleDot aria-hidden="true" className="size-3.5" />
              {matchStatus ? matchStatusLabel(matchStatus, t) : t("status.badge.loading")}
            </Badge>
            <button
              type="button"
              className="btn btn-subtle m-0 min-h-11 px-4"
              onClick={() => {
                void loadState();
              }}
              disabled={isLoadingState}
              aria-busy={isLoadingState}
            >
              <RefreshCcw aria-hidden="true" className="size-4" />
              {t("actions.refresh")}
            </button>
            <button
              type="button"
              className="btn btn-subtle m-0 min-h-11 px-4"
              onClick={onBackToLobbyAction}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("actions.setup")}
            </button>
          </>
        }
      />

      <section
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"
        data-testid="ai-match-room"
      >
        <section className="board-room overflow-hidden p-3 sm:p-5">
          <MatchBoard
            board={board}
            disabled={isBusy || isSubmittingMove || isAiThinking || matchStatus !== "IN_PROGRESS"}
            label={t("board.ariaLabel")}
            lastMove={effectiveUpdate?.lastMove?.position ?? null}
            nextTurnSeat={effectiveUpdate?.nextTurnSeat ?? null}
            onCellSelect={(x, y) => {
              void handleCellSelect(x, y);
            }}
            playerSeat={mySeat}
            testId="ai-match-board"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="m-0 text-sm font-black text-[var(--muted-strong)]">
                {statusLine(effectiveUpdate, mySeat, aiSeat, isAiThinking, aiName, t)}
              </p>
              {aiLastReason ? (
                <p className="m-0 mt-2 text-sm font-bold text-[var(--muted-text)]">
                  {t("match.lastAiMove", { reason: aiLastReason })}
                </p>
              ) : null}
              {loadError || moveError ? (
                <p role="alert" className="m-0 mt-2 text-sm font-bold text-[var(--danger)]">
                  {moveError ?? loadError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-start gap-2 md:justify-end">
              {canRetryAiTurn ? (
                <button
                  type="button"
                  className="btn btn-subtle m-0 min-h-11 px-4"
                  onClick={handleRetryAiTurn}
                >
                  <RefreshCcw aria-hidden="true" className="size-4" />
                  {t("actions.retryAi")}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-danger m-0 min-h-11 px-4"
                onClick={() => {
                  void handleResign();
                }}
                disabled={!canResign || isResigning}
                aria-busy={isResigning}
              >
                {isResigning ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Flag aria-hidden="true" className="size-4" />
                )}
                {t("actions.resign")}
              </button>
            </div>
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <PlayerBar
            blackLabel={t("seat.black")}
            blackName={blackName}
            whiteLabel={t("seat.white")}
            whiteName={whiteName}
          />

          <Surface eyebrow={t("moves.eyebrow")} title={t("moves.title")}>
            <MoveHistory
              moves={moveHistory}
              participants={participants}
              emptyLabel={t("moves.empty")}
            />
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}

function MoveHistory({
  moves,
  participants,
  emptyLabel,
}: {
  moves: MatchMove[];
  participants: ParticipantSummary[];
  emptyLabel: string;
}) {
  const seatByParticipant = new Map(
    participants.map((participant) => [participant.participantId, participant.seat]),
  );
  const recentMoves = moves.slice(-10).reverse();

  if (recentMoves.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--panel-border)] bg-white/[0.035] p-4 text-sm font-bold text-[var(--muted-text)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {recentMoves.map((move) => {
        const seat = seatByParticipant.get(move.participantId) ?? null;

        return (
          <div
            key={move.moveNumber}
            className="grid min-h-11 grid-cols-[3rem_auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3"
          >
            <span className="text-xs font-black text-[var(--muted-text)] tabular-nums">
              #{move.moveNumber}
            </span>
            <span
              aria-hidden="true"
              className={cn("stone size-5", seat === "WHITE" ? "stone-white" : "stone-black")}
            />
            <span className="font-black tabular-nums">{formatBoardPoint(move.position)}</span>
          </div>
        );
      })}
    </div>
  );
}

function statusLine(
  update: GameUpdatePayload | null,
  mySeat: Seat | null,
  aiSeat: Seat | null,
  isAiThinking: boolean,
  aiName: string,
  t: Translator,
) {
  if (!update) {
    return t("status.loading");
  }

  if (update.status === "FINISHED") {
    if (update.winningSeat) {
      return t("status.winner", {
        seat: seatLabel(update.winningSeat, t),
        reason: update.endReason ?? t("status.resultFallback"),
      });
    }

    return t("status.draw", { reason: update.endReason ?? t("status.resultFallback") });
  }

  if (isAiThinking || (aiSeat && update.nextTurnSeat === aiSeat)) {
    return t("status.aiThinking", { aiName });
  }

  if (mySeat && update.nextTurnSeat === mySeat) {
    return t("status.yourMove");
  }

  return t("status.toMove", {
    seat: update.nextTurnSeat ? seatLabel(update.nextTurnSeat, t) : t("seat.opponent"),
  });
}

function matchStatusLabel(status: GameUpdatePayload["status"], t: Translator) {
  if (status === "WAITING") {
    return t("status.badge.waiting");
  }

  if (status === "IN_PROGRESS") {
    return t("status.badge.inProgress");
  }

  if (status === "FINISHED") {
    return t("status.badge.finished");
  }

  return t("status.badge.cancelled");
}

function seatLabel(seat: Seat, t: Translator) {
  return seat === "BLACK" ? t("seat.black") : t("seat.white");
}
