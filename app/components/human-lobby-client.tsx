"use client";

import { RefreshCcw, Swords, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import CreateRoomCard from "@/components/create-room-card";
import GameLobbyTable from "@/components/game-lobby-table";
import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import HumanMatchRoom from "@/components/human-match-room";
import { useHumanLobby } from "@/hooks/useHumanLobby";
import { useMatchInitialize } from "@/hooks/useMatchInitialize";
import type { StoredMatchSession } from "@/lib/matches/match-session-storage";

export default function HumanLobbyClient() {
  const t = useTranslations("human.page");
  const restoredMatch = useMatchInitialize();
  const setRestoredSession = restoredMatch.setSession;
  const [activeSession, setActiveSession] = useState<StoredMatchSession | null>(null);
  const [showLobby, setShowLobby] = useState(false);

  useEffect(() => {
    if (!showLobby && restoredMatch.session) {
      setActiveSession(restoredMatch.session);
    }
  }, [restoredMatch.session, showLobby]);

  const handleSessionReady = useCallback((session: StoredMatchSession) => {
    setShowLobby(false);
    setActiveSession(session);
  }, []);

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
  } = useHumanLobby({ onSessionReady: handleSessionReady });

  const handleBackToLobby = useCallback(() => {
    setShowLobby(true);
    setActiveSession(null);
    void loadMatches();
  }, [loadMatches]);

  const handleSessionLost = useCallback(() => {
    setRestoredSession(null);
    setActiveSession(null);
    setShowLobby(true);
    void loadMatches();
  }, [loadMatches, setRestoredSession]);

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

  if (restoredMatch.isLoading && !showLobby) {
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
    <PageShell>
      <PageHeader
        eyebrow={t("lobby.eyebrow")}
        icon={Swords}
        title={t("lobby.title")}
        lede={t("lobby.lede")}
        actions={
          <>
            <Badge tone="mint">
              <Users aria-hidden="true" className="size-3.5" />
              {t("lobby.looking", {
                count: 8,
              })}
            </Badge>
            <button
              type="button"
              className="btn btn-subtle m-0 min-h-11 px-4"
              onClick={() => {
                void loadMatches();
              }}
              disabled={isLoadingMatches}
              aria-busy={isLoadingMatches}
            >
              <RefreshCcw aria-hidden="true" className="size-4" />
              {t("lobby.refresh")}
            </button>
          </>
        }
      />

      <div className="mb-5 flex max-w-full overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1 sm:inline-flex">
        {[t("lobby.tabs.lobby"), t("lobby.tabs.myRoom"), t("lobby.tabs.history")].map(
          (item, index) => (
            <button
              key={item}
              type="button"
              className={`min-h-10 min-w-32 rounded-sm px-4 text-sm font-black ${
                index === 0
                  ? "bg-[var(--mint-soft)] text-[var(--mint)]"
                  : "text-[var(--muted-text)]"
              }`}
            >
              {item}
            </button>
          ),
        )}
      </div>

      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="grid content-start gap-5">
          <CreateRoomCard
            error={createError}
            isCreating={isCreating}
            onCreateRoom={() => {
              void createRoom();
            }}
            submitLabel={createSubmitLabel}
          />
          <MetricCard icon={Users} label={t("lobby.playersLooking")} tone="mint" value="8" />
        </aside>

        <Surface eyebrow={t("lobby.roomListEyebrow")} title={t("lobby.roomListTitle")}>
          <GameLobbyTable
            entries={entries}
            error={tableError}
            isLoading={isLoadingMatches}
            joiningMatchId={joiningMatchId}
            onJoin={(entry) => {
              void joinMatch(entry);
            }}
          />
        </Surface>
      </section>
    </PageShell>
  );
}
