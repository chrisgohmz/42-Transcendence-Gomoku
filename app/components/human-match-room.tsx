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
  toInitialGameUpdate,
  type MatchStateResponse,
} from "@/lib/matches/match-state";
import { submitMove } from "@/lib/matches/submit-move";
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

const coordinateLabels = "ABCDEFGHJKLMNO".split("");

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

function statusTone(status: GameUpdatePayload["status"] | undefined): "brass" | "mint" | "red" {
  if (status === "IN_PROGRESS") {
    return "mint";
  }

  if (status === "FINISHED" || status === "WAITING") {
    return "brass";
  }

  return "red";
}

export default function HumanMatchRoom({
  initialState,
  isRestoring = false,
  onBackToLobby,
  onSessionLost,
  restoreError,
  session,
}: HumanMatchRoomProps) {
  const [state, setState] = useState<MatchStateResponse | null>(
    initialState?.matchId === session.matchId ? initialState : null,
  );
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(restoreError ?? null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

  const { status: socketStatus, lastUpdate } = useSocketGame(
    session.matchId,
    session.participantId,
  );

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

        setLoadError(getErrorMessage(errorPayload, `State request failed (${response.status})`));
        return;
      }

      const nextState = (await response.json()) as MatchStateResponse;
      setState(nextState);
      setLoadError(null);
    } catch {
      setLoadError("Network error while loading match state");
    } finally {
      setIsLoadingState(false);
    }
  }, [onSessionLost, session.matchId, session.participantId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const liveUpdate = getGameUpdateForSession(lastUpdate, session);
  const initialUpdate = toInitialGameUpdate(state, session);
  const effectiveUpdate = liveUpdate ?? initialUpdate;
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
    () => mergeMoveHistory(state?.moves ?? [], effectiveUpdate?.lastMove ?? null),
    [effectiveUpdate?.lastMove, state?.moves],
  );
  const canResign = effectiveUpdate?.status === "IN_PROGRESS" && mySeat !== null;
  const matchStatus = effectiveUpdate?.status ?? state?.status;
  const isBusy = isRestoring || isLoadingState;

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
      setMoveError(error instanceof Error ? error.message : "Network error while submitting move");
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
        setMoveError(getErrorMessage(errorPayload, `Resign request failed (${response.status})`));
        return;
      }

      await loadState();
    } catch {
      setMoveError("Network error while resigning");
    } finally {
      setIsResigning(false);
    }
  }

  return (
    <PageShell className="human-match-room">
      <PageHeader
        eyebrow="vs Human Match"
        icon={Swords}
        title={matchStatus === "WAITING" ? "Room is open." : "Live room."}
        lede={
          matchStatus === "FINISHED"
            ? "The final position is locked."
            : "Board, turn, and result for this table."
        }
        actions={
          <>
            <Badge tone={statusTone(matchStatus)}>
              <CircleDot aria-hidden="true" className="size-3.5" />
              {matchStatus ?? "Loading"}
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
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-subtle m-0 min-h-11 px-4"
              onClick={onBackToLobby}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Lobby
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
          <Surface eyebrow="Connection" icon={Radio} title="Realtime">
            <div className="grid gap-3 text-sm">
              <DetailRow label="Socket" value={socketStatus} />
              <DetailRow
                label="Version"
                value={effectiveUpdate?.stateVersion ?? state?.stateVersion ?? 0}
              />
              <DetailRow label="You" value={mySeat ?? "Spectator"} />
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
              <p className="m-0 text-sm font-black text-[var(--muted-strong)]">
                {statusLine(effectiveUpdate, mySeat)}
              </p>
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
              Resign
            </button>
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <Surface eyebrow="Match" icon={Trophy} title="State">
            <div className="grid gap-3 text-sm">
              <DetailRow label="Match" value={session.matchId.slice(0, 8)} />
              <DetailRow label="Board" value={`${board.length} x ${board.length}`} />
              <DetailRow label="Next" value={effectiveUpdate?.nextTurnSeat ?? "None"} />
              <DetailRow label="Result" value={resultLabel(effectiveUpdate)} />
            </div>
          </Surface>

          <Surface eyebrow="Moves" title="Notation">
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
          aria-label="Human Gomoku board"
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
                  ? `${cell.seat} stone at ${formatPoint({ x, y })}`
                  : `Empty intersection ${formatPoint({ x, y })}`;

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
  return (
    <Surface eyebrow={seat} icon={UserRound} title={participant?.displayName ?? "Open seat"}>
      <div className="flex flex-wrap gap-2">
        <Badge tone={seatTone(seat)}>{isYou ? "You" : "Opponent"}</Badge>
        {isTurn ? <Badge tone="mint">Turn</Badge> : null}
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
  const seatByParticipant = new Map(
    participants.map((participant) => [participant.participantId, participant.seat]),
  );
  const recentMoves = moves.slice(-10).reverse();

  if (recentMoves.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--panel-border)] bg-white/[0.035] p-4 text-sm font-bold text-[var(--muted-text)]">
        No moves yet.
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

function mergeMoveHistory(
  moves: MatchMove[],
  lastMove: GameUpdatePayload["lastMove"],
): MatchMove[] {
  if (!lastMove || moves.some((move) => move.moveNumber === lastMove.moveNumber)) {
    return moves;
  }

  return [
    ...moves,
    {
      baseVersion: null,
      moveNumber: lastMove.moveNumber,
      participantId: lastMove.participantId,
      position: lastMove.position,
      requestId: lastMove.requestId,
      stateVersion: lastMove.stateVersion,
    },
  ];
}

function statusLine(update: GameUpdatePayload | null, mySeat: Seat | null) {
  if (!update) {
    return "Loading match state.";
  }

  if (update.status === "WAITING") {
    return "Waiting for the second player.";
  }

  if (update.status === "FINISHED") {
    if (update.winningSeat) {
      return `${update.winningSeat} wins by ${update.endReason ?? "result"}.`;
    }

    return `Draw by ${update.endReason ?? "result"}.`;
  }

  if (mySeat && update.nextTurnSeat === mySeat) {
    return "Your move.";
  }

  return `${update.nextTurnSeat ?? "Opponent"} to move.`;
}

function resultLabel(update: GameUpdatePayload | null) {
  if (!update || update.status !== "FINISHED") {
    return "Pending";
  }

  return update.winningSeat ? `${update.winningSeat} won` : "Draw";
}
