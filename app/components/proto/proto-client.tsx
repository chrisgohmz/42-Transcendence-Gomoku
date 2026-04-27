"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { MatchMoveForm, type SubmittedMoveInfo } from "@/components/proto/MatchMoveForm";
import { useSocketGame } from "@/hooks/useSocketGame";

import { MatchCreateButton, type CreatedMatchInfo } from "./MatchCreateButton";
import { MatchJoinButton, type JoinedMatchInfo } from "./MatchJoinButton";

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

export function ProtoClient() {
  const t = useTranslations("proto");
  const [createdMatch, setCreatedMatch] = useState<CreatedMatchInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [joinedMatch, setJoinedMatch] = useState<JoinedMatchInfo | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [displayName, setDisplayname] = useState("");

  const [session, setSession] = useState<MatchSession | null>(null);
  const { status, lastUpdate } = useSocketGame(
    session?.matchId ?? null,
    session?.participantId ?? null,
  );

  const [submittedMove, setSubmittedMove] = useState<SubmittedMoveInfo | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

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
          t("requestFailed", { status: response.status });

        setListError(message);
        setMatches([]);
        return;
      }

      const data = (await response.json()) as Match[];
      setMatches(data);
      setListError(null);
    } catch (loadError) {
      console.error("Error loading matches:", loadError);
      setListError(loadError instanceof Error ? loadError.message : t("networkLoadError"));
      setMatches([]);
    }
  }

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
          {createdMatch ? (
            <p>
              {t("matchId")} {createdMatch.matchId}
            </p>
          ) : null}
          {createdMatch ? (
            <p>
              {t("participantId")} {createdMatch.participantId}
            </p>
          ) : null}
          {createdMatch?.role ? (
            <p>
              {t("role")} {createdMatch.role}
            </p>
          ) : null}
          {createdMatch && createdMatch.seat !== undefined ? (
            <p>
              {t("seat")} {createdMatch.seat ?? t("nullValue")}
            </p>
          ) : null}
          {error ? (
            <p role="alert">
              {t("errorLabel")} {error}
            </p>
          ) : null}
        </article>

        <article className="card">
          <button type="button" className="btn" onClick={loadMatches}>
            {t("loadMatches")}
          </button>
          <p>{t("matches")}</p>
          {listError ? (
            <p role="alert">
              {t("errorLabel")} {listError}
            </p>
          ) : null}
          <ul>
            {matches.map((match) => (
              <li key={match.matchId}>
                <p>
                  {match.matchId}
                  {match.matchId === createdMatch?.matchId ? t("createdMarker") : ""}
                </p>
                {match.status ? (
                  <p>
                    {t("status")} {match.status}
                  </p>
                ) : null}
                {match.participants?.length ? (
                  <p>
                    {t("participants")}{" "}
                    {match.participants
                      .map(
                        (participant) =>
                          `${participant.displayName} (${participant.seat ?? t("nullValue")})`,
                      )
                      .join(", ")}
                  </p>
                ) : null}

                <input
                  type="text"
                  placeholder={t("namePlaceholder")}
                  value={displayName}
                  onChange={(event) => setDisplayname(event.target.value)}
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
                  onError={(message) => {
                    setJoinError(message);
                    setJoinedMatch(null);
                  }}
                />
                {joinedMatch?.matchId === match.matchId ? (
                  <p>
                    {t("seat")} {joinedMatch.seat} / {t("participantId")}{" "}
                    {joinedMatch.participantId}
                  </p>
                ) : null}
                {joinError ? (
                  <p role="alert">
                    {t("errorLabel")} {joinError}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <p>discription status: {status}</p>
          {session ? <p>current match: {session.matchId}</p> : <p>Create or join a match first.</p>}

          {session ? (
            <MatchMoveForm
              matchId={session.matchId}
              participantId={session.participantId}
              baseVersion={lastUpdate?.stateVersion ?? null}
              onSuccess={(info) => {
                setSubmittedMove(info);
                setMoveError(null);
              }}
              onError={(msg) => {
                setMoveError(msg);
              }}
            />
          ) : null}

          {submittedMove ? (
            <p>
              submitted: ({submittedMove.position.x}, {submittedMove.position.y} / requestId: )
              {submittedMove.requestId ?? "null"}
            </p>
          ) : null}
          {moveError ? <p role="alert">error: {moveError}</p> : null}

          {lastUpdate ? (
            <>
              <p>game status: {lastUpdate.status}</p>
              <p>stateVersion: {lastUpdate.stateVersion}</p>
              <p>nextTurnSeat: {lastUpdate.nextTurnSeat ?? "null"}</p>
              {lastUpdate.lastMove ? (
                <p>
                  lastMove: #{lastUpdate.lastMove.moveNumber} / {lastUpdate.lastMove.participantId}{" "}
                  / ({lastUpdate.lastMove.position.x}, {lastUpdate.lastMove.position.y})
                </p>
              ) : (
                <p>lastMove: none</p>
              )}
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
