"use client";

import { RefreshCcw, Swords, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import CreateRoomCard from "@/components/create-room-card";
import GameLobbyTable, { type LobbyEntry } from "@/components/game-lobby-table";
import { Badge, MetricCard, PageHeader, PageShell, Surface } from "@/components/gomoku-ui";
import { saveStoredMatchSession, type StoredMatchSession } from "@/lib/proto/match-session-storage";

import type { Seat } from "../../shared/match-events";

type MatchParticipant = {
  displayName: string;
  seat: Seat | null;
};

type Match = {
  matchId: string;
  status?: string;
  boardSize?: number;
  participants?: MatchParticipant[];
};

type MatchActionResponse = {
  matchId?: string;
  participantId?: string;
  role?: string;
  seat?: Seat | null;
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

function getErrorMessage(payload: ErrorResponse | null, fallback: string) {
  return payload?.message ?? payload?.detail ?? payload?.error ?? fallback;
}

function getStoredRole(role: string | undefined): StoredMatchSession["role"] {
  return role === "SPECTATOR" ? "SPECTATOR" : "PLAYER";
}

function saveMatchSession(session: MatchActionResponse) {
  if (!session.matchId || !session.participantId) {
    return;
  }

  saveStoredMatchSession({
    displayName: "Player",
    matchId: session.matchId,
    participantId: session.participantId,
    role: getStoredRole(session.role),
    seat: session.seat ?? null,
  });
}

function mapMatchToEntry(match: Match): LobbyEntry {
  const hostName = match.participants?.[0]?.displayName ?? "Player";

  return {
    matchId: match.matchId,
    player: hostName,
    playerCount: match.participants?.length ?? 0,
    requiresPassword: false,
    status: match.status,
    boardSize: match.boardSize,
  };
}

export default function HumanLobbyClient() {
  const proto = useTranslations("proto");
  const createT = useTranslations("proto.create");
  const joinT = useTranslations("proto.join");

  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setIsLoadingMatches(true);

    try {
      const response = await fetch("/api/matches", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        setListError(
          getErrorMessage(errorPayload, proto("requestFailed", { status: response.status })),
        );
        setMatches([]);
        return;
      }

      const data = (await response.json()) as Match[];
      setMatches(data);
      setListError(null);
      setJoinError(null);
    } catch (error) {
      console.error("Error loading matches:", error);
      setListError(error instanceof Error ? error.message : proto("networkLoadError"));
      setMatches([]);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [proto]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const createRoom = useCallback(async () => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setCreateError(createT("signInRequired"));
          return;
        }

        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        setCreateError(
          getErrorMessage(errorPayload, proto("requestFailed", { status: response.status })),
        );
        return;
      }

      const result = (await response.json()) as MatchActionResponse;

      if (!result.matchId) {
        setCreateError(createT("missingMatchId"));
        return;
      }

      if (!result.participantId) {
        setCreateError(createT("missingParticipantId"));
        return;
      }

      saveMatchSession(result);
      setJoinError(null);
      await loadMatches();
    } catch {
      setCreateError(createT("networkError"));
    } finally {
      setIsCreating(false);
    }
  }, [createT, loadMatches, proto]);

  const joinMatch = useCallback(
    async (entry: LobbyEntry) => {
      if (!entry.matchId) {
        return;
      }

      setJoiningMatchId(entry.matchId);
      setJoinError(null);

      try {
        const response = await fetch(`/api/matches/${encodeURIComponent(entry.matchId)}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
          setJoinError(
            getErrorMessage(errorPayload, proto("requestFailed", { status: response.status })),
          );
          return;
        }

        const result = (await response.json()) as MatchActionResponse;

        if (!result.participantId) {
          setJoinError(joinT("missingParticipantId"));
          return;
        }

        saveMatchSession({
          ...result,
          matchId: result.matchId ?? entry.matchId,
        });
        setCreateError(null);
        await loadMatches();
      } catch {
        setJoinError(joinT("networkError"));
      } finally {
        setJoiningMatchId(null);
      }
    },
    [joinT, loadMatches, proto],
  );

  const entries = matches.map(mapMatchToEntry);
  const tableError = listError ?? joinError;

  return (
    <PageShell>
      <PageHeader
        eyebrow="vs Human Lobby"
        icon={Swords}
        title="Find a room or open your own."
        lede="Create a ranked table, join a public room, or unlock a private duel without leaving the lobby view."
        actions={
          <>
            <Badge tone="mint">
              <Users aria-hidden="true" className="size-3.5" />8 looking
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
              Refresh
            </button>
          </>
        }
      />

      <div className="mb-5 flex max-w-full overflow-x-auto rounded-md border border-[var(--panel-border-soft)] bg-[var(--panel-solid)] p-1 sm:inline-flex">
        {["Lobby", "My Room", "History"].map((item, index) => (
          <button
            key={item}
            type="button"
            className={`min-h-10 min-w-32 rounded-sm px-4 text-sm font-black ${
              index === 0 ? "bg-[var(--mint-soft)] text-[var(--mint)]" : "text-[var(--muted-text)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="grid content-start gap-5">
          <CreateRoomCard
            error={createError}
            isCreating={isCreating}
            onCreateRoom={() => {
              void createRoom();
            }}
            submitLabel={isCreating ? createT("submitting") : undefined}
          />
          <MetricCard icon={Users} label="Players Looking" tone="mint" value="8" />
        </aside>

        <Surface eyebrow="Lobby" title="Room List">
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
