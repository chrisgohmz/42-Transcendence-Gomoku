"use client";

import {
  Loader2,
  RefreshCcw,
  Search,
  Swords,
  X,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import CreateRoomCard from "@/components/create-room-card";
import GameLobbyTable from "@/components/game-lobby-table";
import {
  MetricCard,
  PageHeader,
  PageShell,
  Surface,
} from "@/components/gomoku-ui";
import HumanMatchRoom from "@/components/human-match-room";
import { usePresence } from "@/components/presence-provider";

import { useHumanLobby } from "@/hooks/useHumanLobby";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import { useMatchInitialize } from "@/hooks/useMatchInitialize";

import {
  clearStoredMatchSession,
  saveStoredMatchSession,
  type StoredMatchSession,
} from "@/lib/matches/match-session-storage";

export default function HumanLobbyClient() {
  const { onlineUsers } = usePresence();
  const restoredMatch = useMatchInitialize();

  const setRestoredSession = restoredMatch.setSession;

  const [activeSession, setActiveSession] =
    useState<StoredMatchSession | null>(null);

  const [showLobby, setShowLobby] = useState(false);

  /**
   * RESTORE SESSION
   */

  useEffect(() => {
    if (!showLobby && restoredMatch.session) {
      setActiveSession(restoredMatch.session);
      // Consume the restored ticket so it doesn't haunt future matches
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

  /**
   * LOBBY
   */

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

  /**
   * MATCHMAKING
   */

  const {
    status,
    position,
    error: queueError,
    joinQueue,
    leaveQueue,
    globalStats,
  } = useMatchmaking({
    onMatchFound: handleSessionReady,
  });

  /**
   * NAVIGATION
   */

  const handleBackToLobby = useCallback(() => {
    if (activeSession) {
      // Throw away the old game ticket immediately
      clearStoredMatchSession(activeSession.matchId);
    }
    setRestoredSession(null);
    setShowLobby(true);
    setActiveSession(null);
    leaveQueue();
    void loadMatches();
  }, [activeSession, loadMatches, leaveQueue, setRestoredSession]);

  const handleSessionLost = useCallback(() => {
    setRestoredSession(null);
    setActiveSession(null);
    setShowLobby(true);
    leaveQueue();
    void loadMatches();
  }, [loadMatches, setRestoredSession, leaveQueue]);

  /**
   * ACTIVE MATCH
   */

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

  /**
   * RESTORING SESSION
   */

  if (restoredMatch.isLoading && !showLobby) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="vs Human Lobby"
          icon={Swords}
          title="Checking your table."
          lede="Loading the most recent active room."
        />
      </PageShell>
    );
  }

  /**
   * PAGE
   */

  return (
    <PageShell>
      <PageHeader
        eyebrow="vs Human Lobby"
        icon={Swords}
        title="Play Online"
        lede="Queue into ranked matchmaking or create a private room with friends."
      />

      {/* ===================================================== */}
      {/* TOP SECTION */}
      {/* ===================================================== */}

      <section className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* ===================================================== */}
        {/* MATCHMAKING */}
        {/* ===================================================== */}

        <Surface className="relative overflow-hidden border border-[var(--panel-border)] bg-[var(--panel-solid)]">
          {/* GLOW */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-[var(--mint-soft)] blur-3xl" />

            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[var(--brass-soft)] blur-3xl" />
          </div>

          <div className="relative flex h-full flex-col justify-between">
            {/* CONTENT */}
            <div className="px-8 pt-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--panel-border-soft)] bg-[var(--panel)] px-3 py-1 text-xs font-black uppercase tracking-wide text-[var(--mint)]">
                <Swords className="size-3.5" />
                Ranked Matchmaking
              </div>

              {status === "idle" ? (
                <>
                  <h2 className="mb-3 text-4xl font-black leading-none tracking-tight">
                    Find Your Next Opponent
                  </h2>

                  <p className="max-w-xl text-base text-[var(--muted-text)]">
                    Jump into competitive online matches and get paired with
                    players near your skill level.
                  </p>

                  {queueError ? (
                    <p className="mt-4 text-sm font-bold text-[var(--danger)]">
                      {queueError}
                    </p>
                  ) : null}

                  <div className="mt-8">
                    <button
                      type="button"
                      className="btn btn-primary h-14 px-10 text-base font-black"
                      onClick={joinQueue}
                    >
                      <Search className="mr-2 size-5" />
                      Find Match
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mb-3 text-4xl font-black leading-none tracking-tight">
                    Searching For Match
                  </h2>

                  <p className="max-w-xl text-base text-[var(--muted-text)]">
                    {position !== null
                      ? `You are currently position ${position} in queue.`
                      : "Looking for an available opponent..."}
                  </p>

                  <div className="mt-8 flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-full bg-[var(--brass-soft)] text-[var(--brass)]">
                      <Loader2 className="size-7 animate-spin" />
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline h-12 px-6"
                      onClick={leaveQueue}
                    >
                      <X className="mr-2 size-4" />
                      Cancel Search
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* LIVE STATS */}
            <div className="mt-8 grid gap-3 border-t border-[var(--panel-border-soft)] p-5 sm:grid-cols-3">
              <MetricCard
                label="Players Online"
                value={onlineUsers.length}
                tone="mint"
              />

              <MetricCard
                label="Searching"
                value={globalStats.searching}
                tone="brass"
              />

              <MetricCard
                label="Live Games"
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
        <div className="border-b border-[var(--panel-border-soft)] px-5 py-3">
          <div className="flex items-center gap-1">
            {["Lobby", "My Room", "History"].map((item, index) => (
              <button
                key={item}
                type="button"
                className={`rounded-md px-4 py-2 text-sm font-black transition-all ${
                  index === 0
                    ? "bg-[var(--mint-soft)] text-[var(--mint)]"
                    : "text-[var(--muted-text)] hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}

            {/* REFRESH */}
            <button
              type="button"
              className="ml-1 flex size-9 items-center justify-center rounded-md text-[var(--muted-text)] transition hover:bg-[var(--panel)] hover:text-white"
              onClick={() => {
                void loadMatches();
              }}
              disabled={isLoadingMatches}
              aria-busy={isLoadingMatches}
            >
              <RefreshCcw
                className={`size-4 ${
                  isLoadingMatches ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="px-5 pb-5 pt-2">
          <GameLobbyTable
            entries={entries}
            error={tableError}
            isLoading={isLoadingMatches}
            joiningMatchId={joiningMatchId}
            onJoin={(entry, password) => {
              void joinMatch(entry, password);
            }}
          />
        </div>
      </Surface>
    </PageShell>
  );
}