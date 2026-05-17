"use client";

import { Loader2, RefreshCcw, Search, Swords, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import CreateRoomCard from "@/components/create-room-card";
import GameLobbyTable from "@/components/game-lobby-table";
import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import HumanMatchRoom from "@/components/human-match-room";
import { usePresence } from "@/components/presence-provider";
import { useHumanLobby } from "@/hooks/useHumanLobby";
import { useMatchInitialize } from "@/hooks/useMatchInitialize";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import {
  clearStoredMatchSession,
  matchSessionClearedEvent,
  matchSessionReadyEvent,
  notifyStoredMatchSessionCleared,
  saveStoredMatchSession,
  type MatchSessionClearedEvent,
  type MatchSessionReadyEvent,
  type StoredMatchSession,
} from "@/lib/matches/match-session-storage";

type ClientHistoryEntry = {
  matchId: string;
  boardSize: number;
  finishedAt: string | null;
  result: "WIN" | "LOSS" | "DRAW" | "CANCELLED" | null;
  moveCount: number;
  currentUserParticipantId: string | null;
  participants: {
    participantId: string;
    userId: string | null;
    displayName: string;
    role: string;
  }[];
};

export default function HumanLobbyClient() {
  const pageT = useTranslations("human.page");
  const { onlineUsers, socket } = usePresence();
  const restoredMatch = useMatchInitialize();

  const setRestoredSession = restoredMatch.setSession;

  const [activeSession, setActiveSession] = useState<StoredMatchSession | null>(null);

  const [showLobby, setShowLobby] = useState(false);
  const [activeTab, setActiveTab] = useState<"lobby" | "history">("lobby");

  const [historyMatches, setHistoryMatches] = useState<ClientHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Pagination memory
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  /* RESTORE SESSION */

  useEffect(() => {
    if (!showLobby && restoredMatch.session) {
      setActiveSession(restoredMatch.session);
      setRestoredSession(null);
    }
  }, [restoredMatch.session, showLobby, setRestoredSession]);

  const handleSessionReady = useCallback(
    (session: StoredMatchSession) => {
      setRestoredSession(null);
      saveStoredMatchSession(session);
      setShowLobby(false);
      setActiveSession(session);
    },
    [setRestoredSession],
  );

  /* LOBBY */

  const {
    createError,
    createRoom,
    createSubmitLabel,
    entries,
    isCreating,
    isLoadingMatches,
    joinMatch,
    joiningMatchId,
    loadMatches,
    tableError,
  } = useHumanLobby({
    onSessionReady: handleSessionReady,
  });

  /* MATCHMAKING */

  const {
    status,
    position,
    error: queueError,
    joinQueue,
    leaveQueue,
    globalStats,
  } = useMatchmaking({
    onMatchFound: handleSessionReady,
    socket,
  });

  /* HISTORY */

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await fetch("/api/matches/history");
      if (!response.ok) {
        if (response.status === 401) {
          setHistoryError(pageT("lobby.history.signInRequired"));
        } else {
          setHistoryError(pageT("lobby.history.failed"));
        }
        return;
      }
      const data = await response.json();
      setHistoryMatches(data.matches || []);
      setHistoryPage(1);
    } catch {
      setHistoryError(pageT("lobby.history.networkError"));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [pageT]);

  useEffect(() => {
    if (activeTab === "history") {
      void loadHistory();
    }
  }, [activeTab, loadHistory]);

  useEffect(() => {
    const handleStoredSessionReady = (event: Event) => {
      const session = (event as MatchSessionReadyEvent).detail;
      if (!session?.matchId || !session.participantId) return;

      handleSessionReady(session);
    };

    const handleStoredSessionCleared = (event: Event) => {
      const { matchId } = (event as MatchSessionClearedEvent).detail;
      if (!matchId) return;

      setActiveSession((current) => {
        if (current?.matchId !== matchId) {
          return current;
        }

        setRestoredSession(null);
        setShowLobby(true);
        void loadMatches();
        void loadHistory();
        return null;
      });
    };

    window.addEventListener(matchSessionReadyEvent, handleStoredSessionReady);
    window.addEventListener(matchSessionClearedEvent, handleStoredSessionCleared);

    return () => {
      window.removeEventListener(matchSessionReadyEvent, handleStoredSessionReady);
      window.removeEventListener(matchSessionClearedEvent, handleStoredSessionCleared);
    };
  }, [handleSessionReady, loadHistory, loadMatches, setRestoredSession]);

  /* NAVIGATION */

  const handleBackToLobby = useCallback(() => {
    if (activeSession) {
      clearStoredMatchSession(activeSession.matchId);
      notifyStoredMatchSessionCleared(activeSession.matchId);
    }
    setRestoredSession(null);
    setShowLobby(true);
    setActiveSession(null);
    leaveQueue();
    void loadMatches();
    void loadHistory();
  }, [activeSession, loadMatches, loadHistory, leaveQueue, setRestoredSession]);

  const handleSessionLost = useCallback(() => {
    setRestoredSession(null);
    setActiveSession(null);
    setShowLobby(true);
    leaveQueue();
    void loadMatches();
    void loadHistory();
  }, [loadMatches, loadHistory, setRestoredSession, leaveQueue]);

  /* ACTIVE MATCH */

  if (activeSession) {
    return (
      <HumanMatchRoom
        initialState={restoredMatch.state}
        isRestoring={restoredMatch.isLoading}
        onBackToLobby={handleBackToLobby}
        onSessionLost={handleSessionLost}
        restoreError={restoredMatch.error}
        session={activeSession}
      />
    );
  }

  /* RESTORING SESSION */

  if (restoredMatch.isLoading && !showLobby) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={pageT("loading.eyebrow")}
          icon={Swords}
          title={pageT("loading.title")}
          lede={pageT("loading.lede")}
        />
      </PageShell>
    );
  }

  /* PREPARE PAGINATION DATA */
  const validHistory = historyMatches.filter((match) => match.participants.length > 1);
  const totalPages = Math.max(1, Math.ceil(validHistory.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = validHistory.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  );

  /* PAGE */

  return (
    <PageShell>
      <PageHeader
        eyebrow={pageT("lobby.eyebrow")}
        icon={Swords}
        title={pageT("lobby.title")}
        lede={pageT("lobby.lede")}
      />

      {/* ===================================================== */}
      {/* TOP SECTION */}
      {/* ===================================================== */}

      <section className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* ===================================================== */}
        {/* MATCHMAKING */}
        {/* ===================================================== */}

        <Surface className="relative overflow-hidden border border-(--panel-border) bg-(--panel-solid)">
          {/* GLOW */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 -left-24 h-64 w-64 rounded-full bg-(--mint-soft) blur-3xl" />

            <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-(--brass-soft) blur-3xl" />
          </div>

          <div className="relative flex h-full flex-col justify-between">
            {/* CONTENT */}
            <div className="px-8 pt-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-(--panel-border-soft) bg-(--panel) px-3 py-1 text-xs font-black tracking-wide text-(--mint) uppercase">
                <Swords className="size-3.5" />
                {pageT("lobby.matchmakingEyebrow")}
              </div>

              {status === "idle" ? (
                <>
                  <h2 className="mb-3 text-4xl leading-none font-black tracking-tight">
                    {pageT("lobby.findTitle")}
                  </h2>

                  <p className="max-w-xl text-base text-(--muted-text)">
                    {pageT("lobby.findLede")}
                  </p>

                  {queueError ? (
                    <p className="mt-4 text-sm font-bold text-(--danger)">{queueError}</p>
                  ) : null}

                  <div className="mt-8">
                    <button
                      type="button"
                      className="btn btn-primary h-14 px-10 text-base font-black"
                      onClick={joinQueue}
                    >
                      <Search className="mr-2 size-5" />
                      {pageT("lobby.findAction")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mb-3 text-4xl leading-none font-black tracking-tight">
                    {pageT("lobby.searchingTitle")}
                  </h2>

                  <p className="max-w-xl text-base text-(--muted-text)">
                    {position !== null
                      ? pageT("lobby.queuePosition", { position })
                      : pageT("lobby.lookingForOpponent")}
                  </p>

                  <div className="mt-8 flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-full bg-(--brass-soft) text-(--brass)">
                      <Loader2 className="size-7 animate-spin" />
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline h-12 px-6"
                      onClick={leaveQueue}
                    >
                      <X className="mr-2 size-4" />
                      {pageT("lobby.cancelSearch")}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* LIVE STATS */}
            <div className="mt-8 grid gap-3 border-t border-(--panel-border-soft) p-5 sm:grid-cols-3">
              <MetricCard
                label={pageT("lobby.stats.playersOnline")}
                value={onlineUsers.length}
                tone="mint"
              />

              <MetricCard
                label={pageT("lobby.stats.searching")}
                value={globalStats.searching}
                tone="brass"
              />

              <MetricCard
                label={pageT("lobby.stats.liveGames")}
                value={globalStats.liveGames}
                tone="plain"
              />
            </div>
          </div>
        </Surface>

        {/* ===================================================== */}
        {/* CREATE ROOM */}
        {/* ===================================================== */}

        <div className="h-full">
          <CreateRoomCard
            error={createError}
            isCreating={isCreating}
            onCreateRoomAction={(data) => {
              void createRoom(data);
            }}
            submitLabel={createSubmitLabel}
          />
        </div>
      </section>

      {/* ===================================================== */}
      {/* ROOM LIST */}
      {/* ===================================================== */}

      <Surface className="overflow-hidden p-0">
        {/* HEADER */}
        <div className="border-b border-(--panel-border-soft) px-5 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("lobby")}
              className={`rounded-md px-4 py-2 text-sm font-black transition-all ${
                activeTab === "lobby"
                  ? "bg-(--mint-soft) text-(--mint)"
                  : "text-(--muted-text) hover:text-white"
              }`}
            >
              {pageT("lobby.tabs.lobby")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`rounded-md px-4 py-2 text-sm font-black transition-all ${
                activeTab === "history"
                  ? "bg-(--mint-soft) text-(--mint)"
                  : "text-(--muted-text) hover:text-white"
              }`}
            >
              {pageT("lobby.tabs.history")}
            </button>

            {/* REFRESH */}
            <button
              type="button"
              className="ml-1 flex size-9 items-center justify-center rounded-md text-(--muted-text) transition hover:bg-(--panel) hover:text-white"
              onClick={() => {
                if (activeTab === "lobby") void loadMatches();
                if (activeTab === "history") void loadHistory();
              }}
              disabled={isLoadingMatches || isLoadingHistory}
              aria-busy={isLoadingMatches || isLoadingHistory}
            >
              <RefreshCcw
                className={`size-4 ${
                  (isLoadingMatches && activeTab === "lobby") ||
                  (isLoadingHistory && activeTab === "history")
                    ? "animate-spin"
                    : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="px-5 pt-2 pb-5">
          {activeTab === "lobby" && (
            <GameLobbyTable
              entries={entries}
              error={tableError}
              isLoading={isLoadingMatches}
              joiningMatchId={joiningMatchId}
              onJoin={(entry, password) => {
                void joinMatch(entry, password);
              }}
            />
          )}

          {activeTab === "history" && (
            <div className="overflow-x-auto rounded-md border border-(--panel-border-soft) bg-white/2.5">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[100px_minmax(150px,1fr)_80px_100px_120px] gap-3 border-b border-(--panel-border-soft) bg-black/20 px-4 py-3 text-xs font-black tracking-[0.12em] text-(--muted-text) uppercase">
                  <span>{pageT("lobby.history.headers.result")}</span>
                  <span>{pageT("lobby.history.headers.opponent")}</span>
                  <span>{pageT("lobby.history.headers.moves")}</span>
                  <span>{pageT("lobby.history.headers.board")}</span>
                  <span>{pageT("lobby.history.headers.date")}</span>
                </div>

                {isLoadingHistory ? (
                  <div className="border-b border-(--panel-border-soft) px-4 py-6 text-sm font-bold text-(--muted-text)">
                    {pageT("lobby.history.loading")}
                  </div>
                ) : historyError ? (
                  <div className="border-b border-(--panel-border-soft) px-4 py-6 text-sm font-bold text-(--danger)">
                    {historyError}
                  </div>
                ) : validHistory.length > 0 ? (
                  <>
                    {paginatedHistory.map((match) => {
                      const opponentParticipant = match.participants.find(
                        (p) =>
                          p.role === "PLAYER" && p.participantId !== match.currentUserParticipantId,
                      );
                      const opponentName =
                        opponentParticipant?.displayName || pageT("lobby.history.unknownPlayer");

                      const isWin = match.result === "WIN";
                      const isLoss = match.result === "LOSS";
                      const isDraw = match.result === "DRAW";

                      const resultTone = isWin ? "mint" : isLoss ? "red" : "neutral";
                      const resultText = isWin
                        ? pageT("lobby.history.results.win")
                        : isLoss
                          ? pageT("lobby.history.results.loss")
                          : isDraw
                            ? pageT("lobby.history.results.draw")
                            : pageT("lobby.history.results.cancelled");

                      const dateText = match.finishedAt
                        ? new Date(match.finishedAt).toLocaleDateString()
                        : pageT("lobby.history.unknownDate");

                      return (
                        <article
                          key={match.matchId}
                          className="grid grid-cols-[100px_minmax(150px,1fr)_80px_100px_120px] items-center gap-3 border-b border-(--panel-border-soft) px-4 py-3 last:border-b-0 hover:bg-white/5"
                        >
                          <div>
                            <Badge tone={resultTone}>{resultText}</Badge>
                          </div>
                          <span className="truncate font-bold text-white">{opponentName}</span>
                          <span className="font-bold text-(--muted-strong) tabular-nums">
                            {match.moveCount}
                          </span>
                          <span className="font-bold text-(--muted-strong)">
                            {match.boardSize} x {match.boardSize}
                          </span>
                          <span className="text-sm text-(--muted-strong)">{dateText}</span>
                        </article>
                      );
                    })}

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-(--panel-border-soft) px-4 py-3 text-sm">
                        <span className="font-bold text-(--muted-text)">
                          {pageT("lobby.history.pagination", { page: historyPage, totalPages })}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                            disabled={historyPage === 1}
                            className="rounded-md border border-(--panel-border-soft) bg-white/3.5 px-4 py-1.5 font-bold text-(--muted-strong) transition-colors hover:bg-white/7 disabled:opacity-50"
                          >
                            {pageT("lobby.history.previous")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                            disabled={historyPage === totalPages}
                            className="rounded-md border border-(--panel-border-soft) bg-white/3.5 px-4 py-1.5 font-bold text-(--muted-strong) transition-colors hover:bg-white/7 disabled:opacity-50"
                          >
                            {pageT("lobby.history.next")}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="border-b border-(--panel-border-soft) px-4 py-6 text-sm font-bold text-(--muted-text)">
                    {pageT("lobby.history.empty")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Surface>
    </PageShell>
  );
}
