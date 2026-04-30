import type { GameUpdatePayload, LastMove, MatchStatus, Seat } from "./match-events";

const matchStatuses = new Set<MatchStatus>(["WAITING", "IN_PROGRESS", "FINISHED", "CANCELLED"]);
const seats = new Set<Seat>(["BLACK", "WHITE"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMatchStatus(value: unknown): value is MatchStatus {
  return typeof value === "string" && matchStatuses.has(value as MatchStatus);
}

function isSeat(value: unknown): value is Seat {
  return typeof value === "string" && seats.has(value as Seat);
}

function isPosition(value: unknown): value is LastMove["position"] {
  return (
    isRecord(value) &&
    typeof value["x"] === "number" &&
    Number.isInteger(value["x"]) &&
    typeof value["y"] === "number" &&
    Number.isInteger(value["y"])
  );
}

function isLastMove(value: unknown): value is LastMove {
  return (
    isRecord(value) &&
    typeof value["moveNumber"] === "number" &&
    Number.isInteger(value["moveNumber"]) &&
    typeof value["participantId"] === "string" &&
    isPosition(value["position"]) &&
    (typeof value["requestId"] === "string" || value["requestId"] === null) &&
    typeof value["stateVersion"] === "number" &&
    Number.isInteger(value["stateVersion"])
  );
}

export function isGameUpdatePayload(value: unknown): value is GameUpdatePayload {
  return (
    isRecord(value) &&
    typeof value["matchId"] === "string" &&
    isMatchStatus(value["status"]) &&
    typeof value["stateVersion"] === "number" &&
    Number.isInteger(value["stateVersion"]) &&
    (isSeat(value["nextTurnSeat"]) || value["nextTurnSeat"] === null) &&
    (isLastMove(value["lastMove"]) || value["lastMove"] === null)
  );
}
