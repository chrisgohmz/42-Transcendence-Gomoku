"use client";

import {
  ArrowLeft,
  CircleDot,
  Flag,
  LoaderCircle,
  Radio,
  RefreshCcw,
  Swords,
  Trophy,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { useSocketGame } from "@/hooks/useSocketGame";
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

type HumanMatchRoomProps = {
  initialState: MatchStateResponse | null;
  isRestoring?: boolean;
  onBackToLobby: () => void;
  onSessionLost: () => void;
  restoreError?: string | null;
  session: StoredMatchSession;
};

type MatchMove = MatchStateResponse["moves"][number];
type TranslationFunction = (key: string, values?: Record<string, string | number>) => string;

const coordinateLabels = "ABCDEFGHJKLMNO".split("");

function seatLabel(seat: Seat | null, t: TranslationFunction) {
  if (seat === "BLACK") {
    return t("seat.black");
  }

  if (seat === "WHITE") {
    return t("seat.white");
  }

  return t("state.none");
}

function socketStatusLabel(status: string, t: TranslationFunction) {
  switch (status) {
    case "idle":
      return t("connection.status.idle");
    case "connecting":
      return t("connection.status.connecting");
    case "subscribed":
      return t("connection.status.connected");
    case "error":
      return t("connection.status.error");
    default:
      return status;
  }
}

function matchStatusLabel(status: GameUpdatePayload["status"] | undefined, t: TranslationFunction) {
  switch (status) {
    case "WAITING":
      return t("status.waiting");
    case "IN_PROGRESS":
      return t("status.inProgress");
    case "FINISHED":
      return t("status.finished");
    default:
      return t("status.loading");
  }
}

function pageTitle(status: GameUpdatePayload["status"] | undefined, t: TranslationFunction) {
  switch (status) {
    case "WAITING":
      return t("page.title.waiting");
    case "IN_PROGRESS":
      return t("page.title.live");
    case "FINISHED":
      return t("page.title.finished");
    default:
      return t("page.title.loading");
  }
}

function pageLede(status: GameUpdatePayload["status"] | undefined, t: TranslationFunction) {
  switch (status) {
    case "WAITING":
      return t("page.lede.waiting");
    case "IN_PROGRESS":
      return t("page.lede.live");
    case "FINISHED":
      return t("page.lede.finished");
    default:
      return t("page.lede.loading");
  }
}

function endReasonLabel(reason: string | null, t: TranslationFunction) {
  switch (reason) {
    case "five_in_a_row":
      return t("endReason.fiveInARow");
    case "resign":
      return t("endReason.resign");
    case "draw":
      return t("endReason.draw");
    case "queue_cancelled":
      return t("endReason.queueCancelled");
    case "queue_expired":
      return t("endReason.queueExpired");
    case "abandoned":
      return t("endReason.abandoned");
    default:
      return reason ?? t("statusLine.resultFallback");
  }
}

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

function formatPoint(position: { x: number; y: number }) {
  return `${coordinateLabels[position.x] ?? position.x + 1}${position.y + 1}`;
}

function seatTone(seat: Seat | null): "brass" | "mint" | "neutral" {
  if (seat === "BLACK") {
    return "brass";
  }

  if (seat === "WHITE") {
    return "mint";
  }

  return "neutral";
}

function statusTone(
  status: GameUpdatePayload["status"] | undefined,
): "brass" | "mint" | "red" | "neutral" {
  if (status === "IN_PROGRESS") {
    return "mint";
  }

  if (status === "FINISHED" || status === "WAITING") {
    return "brass";
  }

  return "neutral";
}

export default function HumanMatchRoom({
  initialState,
  isRestoring = false,
  onBackToLobby,
  onSessionLost,
  restoreError,
  session,
}: HumanMatchRoomProps) {
  const t = useTranslations("human.match");
  const [state, setState] = useState<MatchStateResponse | null>(
    initialState?.matchId === session.matchId ? initialState : null,
  );
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(restoreError ?? null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

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
          onSessionLost();
        }

        setLoadError(
          getErrorMessage(
            errorPayload,
            t("errors.stateRequestFailed", { status: response.status }),
          ),
        );
        return;
      }

      const nextState = (await response.json()) as MatchStateResponse;
      setState(nextState);
      setLoadError(null);
    } catch {
      setLoadError(t("errors.networkLoadState"));
    } finally {
      setIsLoadingState(false);
    }
  }, [onSessionLost, session.matchId, session.participantId, t]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const initialUpdate = toInitialGameUpdate(state, session);
  const { status: socketStatus, lastUpdate } = useSocketGame(
    session.matchId,
    session.participantId,
    initialUpdate?.stateVersion ?? null,
  );
  const liveUpdate = getGameUpdateForSession(lastUpdate, session);
  const effectiveUpdate = selectLatestGameUpdateForSession(initialUpdate, liveUpdate, session);
  const board = effectiveUpdate?.board ?? state?.board ?? emptyBoard(state?.boardSize ?? 15);
  const mySeat = getSessionSeat(state, session) ?? session.seat;
  const participantBySeat = useMemo(() => {
    const participants = effectiveUpdate?.participants ?? [];
    return {
      BLACK: participants.find((participant) => participant.seat === "BLACK") ?? null,
      WHITE: participants.find((participant) => participant.seat === "WHITE") ?? null,
    };
  }, [effectiveUpdate?.participants]);
  const moveHistory = useMemo(
    () => effectiveUpdate?.moves ?? state?.moves ?? [],
    [effectiveUpdate?.moves, state?.moves],
  );
  const canResign = effectiveUpdate?.status === "IN_PROGRESS" && mySeat !== null;
  const matchStatus = effectiveUpdate?.status ?? state?.status;
  const isBusy = isRestoring || isLoadingState;
  const pageHeaderTitle = pageTitle(matchStatus, t);
  const pageHeaderLede = pageLede(matchStatus, t);
  const matchStatusText = matchStatusLabel(matchStatus, t);
  const socketStatusText = socketStatusLabel(socketStatus, t);
  const statusLineText = statusLine(effectiveUpdate, mySeat, t);
  const resultText = resultLabel(effectiveUpdate, t);

  async function handleCellSelect(x: number, y: number) {
    if (!effectiveUpdate || !mySeat || effectiveUpdate.status !== "IN_PROGRESS") {
      return;
    }

    setIsSubmittingMove(true);
    setMoveError(null);

    try {
      await submitMove({
        matchId: session.matchId,
        participantId: session.participantId,
        position: { x, y },
        baseVersion: effectiveUpdate.stateVersion,
      });
      await loadState();
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : t("errors.submitMove"));
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
          participantId: session.participantId,
          baseVersion: effectiveUpdate.stateVersion,
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
    <PageShell className="human-match-room">
      <PageHeader
        eyebrow={t("page.eyebrow")}
        icon={Swords}
        title={pageHeaderTitle}
        lede={pageHeaderLede}
        actions={
          <>
            <Badge tone={statusTone(matchStatus)}>
              <CircleDot aria-hidden="true" className="size-3.5" />
              {matchStatusText}
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
              {t("page.refresh")}
            </button>
            <button
              type="button"
              className="btn btn-subtle m-0 min-h-11 px-4"
              onClick={onBackToLobby}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("page.lobby")}
            </button>
          </>
        }
      />

      <section
        className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_300px]"
        data-testid="human-match-room"
      >
        <aside className="grid content-start gap-5">
          <SeatPanel
            participant={participantBySeat.BLACK}
            isTurn={effectiveUpdate?.nextTurnSeat === "BLACK"}
            isYou={mySeat === "BLACK"}
            seat="BLACK"
          />
          <SeatPanel
            participant={participantBySeat.WHITE}
            isTurn={effectiveUpdate?.nextTurnSeat === "WHITE"}
            isYou={mySeat === "WHITE"}
            seat="WHITE"
          />
          <Surface eyebrow={t("connection.eyebrow")} icon={Radio} title={t("connection.title")}>
            <div className="grid gap-3 text-sm">
              <DetailRow label={t("connection.socket")} value={socketStatusText} />
              <DetailRow
                label={t("connection.version")}
                value={effectiveUpdate?.stateVersion ?? state?.stateVersion ?? 0}
              />
              <DetailRow
                label={t("connection.you")}
                value={mySeat ? seatLabel(mySeat, t) : t("connection.spectator")}
              />
            </div>
          </Surface>
        </aside>

        <section className="board-room overflow-hidden p-3 sm:p-5">
          <HumanGomokuBoard
            board={board}
            disabled={isBusy || isSubmittingMove || matchStatus !== "IN_PROGRESS"}
            lastMove={effectiveUpdate?.lastMove?.position ?? null}
            mySeat={mySeat}
            nextTurnSeat={effectiveUpdate?.nextTurnSeat ?? null}
            onCellSelect={(x, y) => {
              void handleCellSelect(x, y);
            }}
          />

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="m-0 text-sm font-black text-[var(--muted-strong)]">{statusLineText}</p>
              {loadError || moveError ? (
                <p role="alert" className="m-0 mt-2 text-sm font-bold text-[var(--danger)]">
                  {moveError ?? loadError}
                </p>
              ) : null}
            </div>
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
        </section>

        <aside className="grid content-start gap-5">
          <Surface eyebrow={t("state.eyebrow")} icon={Trophy} title={t("state.title")}>
            <div className="grid gap-3 text-sm">
              <DetailRow label={t("state.match")} value={session.matchId.slice(0, 8)} />
              <DetailRow label={t("state.board")} value={`${board.length} x ${board.length}`} />
              <DetailRow
                label={t("state.next")}
                value={
                  effectiveUpdate?.nextTurnSeat
                    ? seatLabel(effectiveUpdate.nextTurnSeat, t)
                    : t("state.none")
                }
              />
              <DetailRow label={t("state.result")} value={resultText} />
            </div>
          </Surface>

          <Surface eyebrow={t("moves.eyebrow")} title={t("moves.title")}>
            <MoveHistory moves={moveHistory} participants={effectiveUpdate?.participants ?? []} />
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}

function HumanGomokuBoard({
  board,
  disabled,
  lastMove,
  mySeat,
  nextTurnSeat,
  onCellSelect,
}: {
  board: Cell[][];
  disabled: boolean;
  lastMove: { x: number; y: number } | null;
  mySeat: Seat | null;
  nextTurnSeat: Seat | null;
  onCellSelect: (x: number, y: number) => void;
}) {
  const t = useTranslations("human.match");
  const boardSize = board.length;
  const labels = coordinateLabels.slice(0, boardSize);

  return (
    <div className="mx-auto w-full max-w-[min(78vh,820px)]" data-testid="human-match-board">
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] grid-rows-[1.5rem_minmax(0,1fr)] gap-1 sm:grid-cols-[2rem_minmax(0,1fr)] sm:grid-rows-[2rem_minmax(0,1fr)]">
        <span aria-hidden="true" />
        <div
          aria-hidden="true"
          className="grid text-center text-[0.62rem] font-black text-[var(--muted-text)] sm:text-xs"
          style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
        >
          {labels.map((label) => (
            <span key={label} className="self-center">
              {label}
            </span>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="grid text-center text-[0.62rem] font-black text-[var(--muted-text)] sm:text-xs"
          style={{ gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))` }}
        >
          {board.map((_, index) => (
            <span key={index} className="self-center tabular-nums">
              {index + 1}
            </span>
          ))}
        </div>
        <div
          aria-colcount={boardSize}
          aria-label={t("board.ariaLabel")}
          aria-rowcount={boardSize}
          className="grid aspect-square overflow-hidden rounded-md border border-[#5f3417] bg-[linear-gradient(135deg,#f2c77f,#ca843e_58%,#8c4e1d)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.44)]"
          role="grid"
          style={{ gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))` }}
        >
          {board.map((row, y) => (
            <div
              key={y}
              className="grid min-h-0"
              role="row"
              style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
            >
              {row.map((cell, x) => {
                const isLastMove = lastMove?.x === x && lastMove.y === y;
                const canPlay =
                  !disabled &&
                  !cell.occupied &&
                  mySeat !== null &&
                  nextTurnSeat !== null &&
                  mySeat === nextTurnSeat;
                const label = cell.occupied
                  ? t("board.stoneAt", {
                      seat: seatLabel(cell.seat, t),
                      point: formatPoint({ x, y }),
                    })
                  : t("board.emptyIntersection", { point: formatPoint({ x, y }) });

                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    aria-label={label}
                    aria-rowindex={y + 1}
                    aria-colindex={x + 1}
                    aria-current={isLastMove ? "step" : undefined}
                    className={cn(
                      "group relative grid min-h-0 place-items-center border border-[#6c3d1d]/35 outline-none transition-[background-color,box-shadow]",
                      canPlay
                        ? "cursor-pointer hover:bg-white/16 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--mint)]"
                        : "cursor-default",
                    )}
                    disabled={!canPlay}
                    onClick={() => onCellSelect(x, y)}
                    role="gridcell"
                  >
                    {cell.occupied ? (
                      <span
                        className={cn(
                          "stone grid size-[72%] place-items-center text-[0.55rem] font-black tabular-nums sm:text-[0.65rem]",
                          cell.seat === "BLACK"
                            ? "stone-black text-white/70"
                            : "stone-white text-black/60",
                          isLastMove &&
                            "ring-2 ring-[var(--mint)] ring-offset-2 ring-offset-[var(--wood-dark)]",
                        )}
                      >
                        {cell.moveNumber}
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="size-[22%] rounded-full bg-[var(--mint)] opacity-0 shadow-[0_0_14px_var(--mint)] transition-opacity group-hover:opacity-70 group-focus-visible:opacity-90"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeatPanel({
  isTurn,
  isYou,
  participant,
  seat,
}: {
  isTurn: boolean;
  isYou: boolean;
  participant: ParticipantSummary | null;
  seat: Seat;
}) {
  const t = useTranslations("human.match");
  return (
    <Surface
      eyebrow={seatLabel(seat, t)}
      icon={UserRound}
      title={participant?.displayName ?? t("seat.openSeat")}
    >
      <div className="flex flex-wrap gap-2">
        <Badge tone={seatTone(seat)}>{isYou ? t("seat.you") : t("seat.opponent")}</Badge>
        {isTurn ? <Badge tone="mint">{t("seat.turn")}</Badge> : null}
      </div>
    </Surface>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] px-3">
      <span className="text-[var(--muted-text)]">{label}</span>
      <span className="min-w-0 truncate font-black">{value}</span>
    </div>
  );
}

function MoveHistory({
  moves,
  participants,
}: {
  moves: MatchMove[];
  participants: ParticipantSummary[];
}) {
  const t = useTranslations("human.match");
  const seatByParticipant = new Map(
    participants.map((participant) => [participant.participantId, participant.seat]),
  );
  const recentMoves = moves.slice(-10).reverse();

  if (recentMoves.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--panel-border)] bg-white/[0.035] p-4 text-sm font-bold text-[var(--muted-text)]">
        {t("moves.empty")}
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
            <span className="font-black tabular-nums">{formatPoint(move.position)}</span>
          </div>
        );
      })}
    </div>
  );
}

function statusLine(update: GameUpdatePayload | null, mySeat: Seat | null, t: TranslationFunction) {
  if (!update) {
    return t("statusLine.loading");
  }

  if (update.status === "WAITING") {
    return t("statusLine.waiting");
  }

  if (update.status === "FINISHED") {
    if (update.winningSeat) {
      if (update.endReason === "resign") {
        return t("statusLine.winnerByResign", { seat: seatLabel(update.winningSeat, t) });
      }

      return t("statusLine.winner", {
        seat: seatLabel(update.winningSeat, t),
        reason: endReasonLabel(update.endReason, t),
      });
    }

    return t("statusLine.draw");
  }

  if (mySeat && update.nextTurnSeat === mySeat) {
    return t("statusLine.yourMove");
  }

  return t("statusLine.toMove", {
    seat: seatLabel(update.nextTurnSeat, t),
  });
}

function resultLabel(update: GameUpdatePayload | null, t: TranslationFunction) {
  if (!update || update.status !== "FINISHED") {
    return t("result.pending");
  }

  return update.winningSeat
    ? t("result.won", { seat: seatLabel(update.winningSeat, t) })
    : t("result.draw");
}
