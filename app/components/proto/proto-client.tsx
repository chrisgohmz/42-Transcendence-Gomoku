"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { MatchMoveForm } from "@/components/proto/MatchMoveForm";
import { submitMove, type SubmittedMoveInfo } from "@/components/proto/submit-move";
import { useSocketGame } from "@/hooks/useSocketGame";

import type { Seat } from "../../../shared/match-events";
import { MatchCreateButton, type CreatedMatchInfo } from "./MatchCreateButton";
import { MatchJoinButton, type JoinedMatchInfo } from "./MatchJoinButton";
import { MiniBoard } from "./MiniBoard";

type MatchParticipant = {
  displayName: string;
  seat: Seat | null;
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
  const [isSubmittingBoardMove, setIsSubmittingBoardMove] = useState(false);

  async function handleBoardCellClick(x: number, y: number) {
    if (!session) {
      return;
    }

    setIsSubmittingBoardMove(true);
    setMoveError(null);

    try {
      const nextSubmittedMove = await submitMove({
        matchId: session.matchId,
        participantId: session.participantId,
        position: { x, y },
        baseVersion: lastUpdate?.stateVersion ?? null,
      });
      setSubmittedMove(nextSubmittedMove);
    } catch (submitError) {
      setMoveError(
        submitError instanceof Error ? submitError.message : "Network error while submitting move",
      );
    } finally {
      setIsSubmittingBoardMove(false);
    }
  }

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
          <p>{t("descriptionStatus", { status })}</p>
          {session ? (
            <p>{t("currentMatch", { matchId: session.matchId })}</p>
          ) : (
            <p>{t("createOrJoinFirst")}</p>
          )}

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
              {t("submittedMove", {
                x: submittedMove.position.x,
                y: submittedMove.position.y,
                requestId: submittedMove.requestId ?? t("nullValue"),
              })}
            </p>
          ) : null}
          {moveError ? <p role="alert">{t("moveError", { message: moveError })}</p> : null}

          {lastUpdate ? (
            <>
              <p>{t("gameStatus", { status: lastUpdate.status })}</p>
              <p>{t("stateVersion", { version: lastUpdate.stateVersion })}</p>
              <p>{t("nextTurnSeat", { seat: lastUpdate.nextTurnSeat ?? t("nullValue") })}</p>
              {lastUpdate.lastMove ? (
                <p>
                  {t("lastMove", {
                    moveNumber: lastUpdate.lastMove.moveNumber,
                    participantId: lastUpdate.lastMove.participantId,
                    x: lastUpdate.lastMove.position.x,
                    y: lastUpdate.lastMove.position.y,
                  })}
                </p>
              ) : (
                <p>{t("lastMoveNone")}</p>
              )}

              {lastUpdate.board ? (
                <MiniBoard
                  board={lastUpdate.board}
                  disabled={isSubmittingBoardMove}
                  mySeat={session ? (createdMatch?.seat ?? joinedMatch?.seat ?? null) : null}
                  nextTurnSeat={lastUpdate.nextTurnSeat}
                  onCellClick={(x, y) => {
                    void handleBoardCellClick(x, y);
                  }}
                />
              ) : null}
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
