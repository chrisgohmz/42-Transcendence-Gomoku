"use client";

import { useState } from "react";

import { MatchJoinButton, type JoinedMatchInfo } from "@/components/proto/MatchJoinButton";
import { useSocketGame } from "@/hooks/useSocketGame";

import { MatchCreateButton, type CreatedMatchInfo } from "../components/proto/MatchCreateButton";

type MatchParticipant = {
  displayName: string;
  seat: string | null;
};

type Match = {
  matchId: string;
  status?: string;
  participants?: MatchParticipant[];
};

type ErrorResponse = {
  message?: string;
  detail?: string;
  error?: string;
};

type MatchSession = {
  matchId: string;
  participantId: string;
};

export default function ProtoPage() {
  const [createdMatch, setCreatedMatch] = useState<CreatedMatchInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [joinedMatch, setJoinedMatch] = useState<JoinedMatchInfo | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [displayName, setDisplayname] = useState("");

  const [session, setSession] = useState<MatchSession | null>(null);

  const { status } = useSocketGame(session?.matchId ?? null, session?.participantId ?? null);

  async function loadMatches() {
    try {
      const response = await fetch("/api/matches", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ErrorResponse | null;
        const message =
          errorPayload?.message ??
          errorPayload?.detail ??
          errorPayload?.error ??
          `Request failed with status ${response.status}`;

        setListError(message);
        setMatches([]);
        return;
      }

      const data = (await response.json()) as Match[];
      setMatches(data);
      setListError(null);
    } catch (error) {
      console.error("Error loading matches:", error);
      setListError(error instanceof Error ? error.message : "Network error while loading matches");
      setMatches([]);
    }
  }

  // Memo: if we want to use useEffect for loadRooms
  // Put this at the top of this code
  // import { useState } from "react";
  //
  // and activate these hundler
  // useEffect(() => {
  //   void loadRooms();
  // }, []);

  function handleSuccess(nextCreatedMatch: CreatedMatchInfo) {
    setCreatedMatch(nextCreatedMatch);
    setError(null);
    setSession({
      matchId: nextCreatedMatch.matchId,
      participantId: nextCreatedMatch.participantId,
    });
  }

  function handleError(message: string) {
    setError(message);
    setCreatedMatch(null);
  }

  return (
    <main className="shell">
      <section className="panel">
        <article className="card">
          <MatchCreateButton onSuccess={handleSuccess} onError={handleError} />
          {createdMatch ? <p>matchId: {createdMatch.matchId}</p> : null}
          {createdMatch ? <p>participantId: {createdMatch.participantId}</p> : null}
          {createdMatch?.role ? <p>role: {createdMatch.role}</p> : null}
          {createdMatch && createdMatch.seat !== undefined ? (
            <p>seat: {createdMatch.seat ?? "null"}</p>
          ) : null}
          {error ? <p role="alert">error: {error}</p> : null}
        </article>

        <article className="card">
          <button type="button" className="btn" onClick={loadMatches}>
            Load Matches
          </button>
          <p>matches:</p>
          {listError ? <p role="alert">error: {listError}</p> : null}
          <ul>
            {matches.map((match) => (
              <li key={match.matchId}>
                <p>
                  {match.matchId}
                  {match.matchId === createdMatch?.matchId ? " <- just created" : ""}
                </p>
                {match.status ? <p>status: {match.status}</p> : null}
                {match.participants?.length ? (
                  <p>
                    participants:{" "}
                    {match.participants
                      .map(
                        (participant) =>
                          `${participant.displayName} (${participant.seat ?? "null"})`,
                      )
                      .join(", ")}
                  </p>
                ) : null}

                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayname(e.target.value)}
                />
                <MatchJoinButton
                  matchId={match.matchId}
                  displayName={displayName}
                  onSuccess={(info) => {
                    setJoinedMatch(info);
                    setJoinError(null);
                    setSession({
                      matchId: info.matchId,
                      participantId: info.participantId,
                    });
                  }}
                  onError={(msg) => {
                    setJoinError(msg);
                    setJoinedMatch(null);
                  }}
                />
                {joinedMatch?.matchId === match.matchId ? (
                  <p>
                    seat: {joinedMatch.seat} / participantId: {joinedMatch.participantId}
                  </p>
                ) : null}
                {joinError ? <p role="alert">error: {joinError}</p> : null}
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <p>discription status: {status}</p>
        </article>
      </section>
    </main>
  );
}
