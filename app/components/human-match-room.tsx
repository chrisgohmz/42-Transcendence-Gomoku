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
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import MatchBoard, { formatBoardPoint } from "@/components/match-board";
import PlayerBar from "@/components/player-bar";
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
  const canReturnToLobby = matchStatus === "FINISHED" || matchStatus === "CANCELLED";
  const isBusy = isRestoring || isLoadingState;

  // Visual local timer countdown
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    if (matchStatus !== "IN_PROGRESS" || !state) return;

    // The game starts exactly when the second player takes their seat
    const playerJoinTimes = state.participants
      .filter((p) => p.role === "PLAYER")
      .map((p) => new Date(p.joinedAt).getTime());

    const startTime = playerJoinTimes.length === 2 ? Math.max(...playerJoinTimes) : Date.now();

    const updateTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      setTimeLeft(Math.max(0, 600 - elapsedSeconds));
    };

    updateTimer(); // Sync instantly on load
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [matchStatus, state]);

  const formattedTime = `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`;

  const blackName = participantBySeat.BLACK?.displayName ?? "Waiting...";
  const whiteName = participantBySeat.WHITE?.displayName ?? "Waiting...";

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
        setMoveError(getErrorMessage(errorPayload, `Resign request failed (${response.status})`));
        if (errorCode === "stale_state") {
          await loadState();
        }
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

            {mySeat !== null && (
              <button
                type="button"
                className="btn btn-danger m-0 min-h-11 px-4"
                onClick={() => {
                  void handleResign();
                }}
                disabled={!canResign || isResigning}
                aria-busy={isResigning}
                title="Resign from the match"
              >
                {isResigning ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Flag aria-hidden="true" className="size-4" />
                )}
                <span className="hidden sm:inline">Resign</span>
              </button>
            )}

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
              onClick={() => {
                if (canReturnToLobby) {
                  onBackToLobby();
                }
              }}
              disabled={!canReturnToLobby}
              title={canReturnToLobby ? "Back to lobby" : "Lobby unlocks when the match ends"}
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

          <Surface eyebrow="Match" icon={Trophy} title="State">
            <div className="grid gap-3 text-sm">
              <DetailRow label="Match" value={session.matchId.slice(0, 8)} />
              <DetailRow label="Board" value={`${board.length} x ${board.length}`} />
              <DetailRow label="Status" value={statusLine(effectiveUpdate, mySeat)} />
            </div>
          </Surface>
        </aside>

        <section className="board-room overflow-hidden p-3 sm:p-5">
          <MatchBoard
            board={board}
            disabled={isBusy || isSubmittingMove || matchStatus !== "IN_PROGRESS"}
            label="Human Gomoku board"
            lastMove={effectiveUpdate?.lastMove?.position ?? null}
            nextTurnSeat={effectiveUpdate?.nextTurnSeat ?? null}
            onCellSelect={(x, y) => {
              void handleCellSelect(x, y);
            }}
            playerSeat={mySeat}
            testId="human-match-board"
          />

          {loadError || moveError ? (
            <p
              role="alert"
              className="mx-auto mt-6 max-w-[min(78vh,820px)] rounded-md border border-(--danger)/30 bg-(--danger)/10 p-3 text-center text-sm font-bold text-(--danger)"
            >
              {moveError ?? loadError}
            </p>
          ) : null}
        </section>

        <aside className="grid content-start gap-5">
          <PlayerBar blackName={blackName} whiteName={whiteName} timer={formattedTime} />

          <Surface eyebrow="Moves" title="Notation">
            <MoveHistory moves={moveHistory} participants={effectiveUpdate?.participants ?? []} />
          </Surface>
        </aside>
      </section>
    </PageShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-(--panel-border-soft) bg-white/3.5 px-3">
      <span className="text-(--muted-text)">{label}</span>
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
      <div className="rounded-md border border-dashed border-(--panel-border) bg-white/3.5 p-4 text-sm font-bold text-(--muted-text)">
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
            className="grid min-h-11 grid-cols-[3rem_auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-(--panel-border-soft) bg-white/3.5 px-3"
          >
            <span className="text-xs font-black text-(--muted-text) tabular-nums">
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
