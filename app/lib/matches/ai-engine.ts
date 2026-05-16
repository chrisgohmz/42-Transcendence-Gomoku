import { getAiDifficulty, type AiDifficultyId } from "@/lib/matches/ai-difficulty";

import type { Seat } from "../../../shared/match-events";

type BoardCell = Seat | null;
type Position = { x: number; y: number };

export type AiEngineMove = {
  participantId: string;
  moveNumber: number;
  x: number;
  y: number;
};

export type AiEngineParticipant = {
  id: string;
  seat: Seat | null;
};

export type AiMoveChoice = {
  candidateCount: number;
  difficultyId: AiDifficultyId;
  position: Position;
  reason: string;
  score: number;
  searchedPlies: number;
  selectedFromTop: number;
};

type ScoredCandidate = {
  position: Position;
  score: number;
  selectionScore: number;
};

const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;
const winScore = 1_000_000;

function otherSeat(seat: Seat): Seat {
  return seat === "BLACK" ? "WHITE" : "BLACK";
}

function positionKey(position: Position): string {
  return `${position.x}:${position.y}`;
}

function isInside(position: Position, boardSize: number): boolean {
  return position.x >= 0 && position.x < boardSize && position.y >= 0 && position.y < boardSize;
}

function getCell(board: BoardCell[][], position: Position): BoardCell {
  return board[position.y]?.[position.x] ?? null;
}

function isEmptyIntersection(board: BoardCell[][], position: Position): boolean {
  return isInside(position, board.length) && getCell(board, position) === null;
}

function setCell(board: BoardCell[][], position: Position, seat: BoardCell) {
  const row = board[position.y];
  if (row) {
    row[position.x] = seat;
  }
}

function buildBoard(
  boardSize: number,
  participants: AiEngineParticipant[],
  moves: AiEngineMove[],
): BoardCell[][] {
  const seatByParticipant = new Map<string, Seat>();

  for (const participant of participants) {
    if (participant.seat === "BLACK" || participant.seat === "WHITE") {
      seatByParticipant.set(participant.id, participant.seat);
    }
  }

  const board: BoardCell[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => null),
  );

  for (const move of [...moves].sort((a, b) => a.moveNumber - b.moveNumber)) {
    const seat = seatByParticipant.get(move.participantId);
    const position = { x: move.x, y: move.y };

    if (seat && isInside(position, boardSize)) {
      setCell(board, position, seat);
    }
  }

  return board;
}

function hasAnyStone(board: BoardCell[][]): boolean {
  return board.some((row) => row.some((cell) => cell !== null));
}

function hasEmptyCell(board: BoardCell[][]): boolean {
  return board.some((row) => row.some((cell) => cell === null));
}

function countContiguous(
  board: BoardCell[][],
  start: Position,
  seat: Seat,
  dx: number,
  dy: number,
): number {
  let count = 0;
  let position = { x: start.x + dx, y: start.y + dy };

  while (getCell(board, position) === seat) {
    count += 1;
    position = { x: position.x + dx, y: position.y + dy };
  }

  return count;
}

function hasFiveInRow(board: BoardCell[][], position: Position, seat: Seat): boolean {
  return directions.some(([dx, dy]) => {
    const total =
      1 +
      countContiguous(board, position, seat, dx, dy) +
      countContiguous(board, position, seat, -dx, -dy);

    return total >= 5;
  });
}

function lineScore(length: number, openEnds: number): number {
  if (length >= 5) {
    return winScore;
  }

  if (length === 4) {
    return openEnds === 2 ? 120_000 : openEnds === 1 ? 18_000 : 900;
  }

  if (length === 3) {
    return openEnds === 2 ? 9_200 : openEnds === 1 ? 1_400 : 120;
  }

  if (length === 2) {
    return openEnds === 2 ? 520 : openEnds === 1 ? 90 : 12;
  }

  return openEnds === 2 ? 28 : 6;
}

function bestLineAtPosition(board: BoardCell[][], position: Position, seat: Seat) {
  let best = { length: 1, openEnds: 0, score: 0 };

  for (const [dx, dy] of directions) {
    const forward = countContiguous(board, position, seat, dx, dy);
    const backward = countContiguous(board, position, seat, -dx, -dy);
    const length = 1 + forward + backward;
    const forwardEnd = { x: position.x + (forward + 1) * dx, y: position.y + (forward + 1) * dy };
    const backwardEnd = {
      x: position.x - (backward + 1) * dx,
      y: position.y - (backward + 1) * dy,
    };
    const openEnds =
      (isEmptyIntersection(board, forwardEnd) ? 1 : 0) +
      (isEmptyIntersection(board, backwardEnd) ? 1 : 0);
    const score = lineScore(length, openEnds);

    if (score > best.score) {
      best = { length, openEnds, score };
    }
  }

  return best;
}

function scoreSeat(board: BoardCell[][], boardSize: number, seat: Seat): number {
  let score = 0;

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const position = { x, y };
      if (getCell(board, position) !== seat) {
        continue;
      }

      for (const [dx, dy] of directions) {
        const previous = { x: x - dx, y: y - dy };
        if (getCell(board, previous) === seat) {
          continue;
        }

        let length = 0;
        let cursor = position;
        while (getCell(board, cursor) === seat) {
          length += 1;
          cursor = { x: cursor.x + dx, y: cursor.y + dy };
        }

        const openEnds =
          (isEmptyIntersection(board, previous) ? 1 : 0) +
          (isEmptyIntersection(board, cursor) ? 1 : 0);
        score += lineScore(length, openEnds);
      }
    }
  }

  return score;
}

function evaluateBoard(
  board: BoardCell[][],
  boardSize: number,
  aiSeat: Seat,
  defenseWeight: number,
): number {
  const opponentSeat = otherSeat(aiSeat);
  return (
    scoreSeat(board, boardSize, aiSeat) - scoreSeat(board, boardSize, opponentSeat) * defenseWeight
  );
}

function centerBias(position: Position, boardSize: number): number {
  const center = (boardSize - 1) / 2;
  return Math.max(0, boardSize - Math.abs(position.x - center) - Math.abs(position.y - center));
}

function moveOrderingScore(
  board: BoardCell[][],
  boardSize: number,
  position: Position,
  seatToMove: Seat,
): number {
  const opponentSeat = otherSeat(seatToMove);
  let score = centerBias(position, boardSize) * 5;

  setCell(board, position, seatToMove);
  score += hasFiveInRow(board, position, seatToMove)
    ? winScore
    : bestLineAtPosition(board, position, seatToMove).score;
  setCell(board, position, null);

  setCell(board, position, opponentSeat);
  score += hasFiveInRow(board, position, opponentSeat)
    ? winScore * 0.96
    : bestLineAtPosition(board, position, opponentSeat).score * 0.7;
  setCell(board, position, null);

  return score;
}

function collectCandidatePositions(
  board: BoardCell[][],
  boardSize: number,
  neighborRadius: number,
): Position[] {
  if (!hasAnyStone(board)) {
    const center = Math.floor(boardSize / 2);
    return [{ x: center, y: center }];
  }

  const candidates = new Map<string, Position>();

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      if (getCell(board, { x, y }) === null) {
        continue;
      }

      for (let dy = -neighborRadius; dy <= neighborRadius; dy += 1) {
        for (let dx = -neighborRadius; dx <= neighborRadius; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const position = { x: x + dx, y: y + dy };
          if (isInside(position, boardSize) && getCell(board, position) === null) {
            candidates.set(positionKey(position), position);
          }
        }
      }
    }
  }

  return [...candidates.values()];
}

function selectCandidatePositions(
  board: BoardCell[][],
  boardSize: number,
  seatToMove: Seat,
  neighborRadius: number,
  candidateLimit: number,
): Position[] {
  return collectCandidatePositions(board, boardSize, neighborRadius)
    .sort(
      (left, right) =>
        moveOrderingScore(board, boardSize, right, seatToMove) -
        moveOrderingScore(board, boardSize, left, seatToMove),
    )
    .slice(0, candidateLimit);
}

function minimax({
  aiSeat,
  alpha,
  beta,
  board,
  boardSize,
  candidateLimit,
  defenseWeight,
  depth,
  neighborRadius,
  seatToMove,
}: {
  aiSeat: Seat;
  alpha: number;
  beta: number;
  board: BoardCell[][];
  boardSize: number;
  candidateLimit: number;
  defenseWeight: number;
  depth: number;
  neighborRadius: number;
  seatToMove: Seat;
}): number {
  if (depth <= 0 || !hasEmptyCell(board)) {
    return evaluateBoard(board, boardSize, aiSeat, defenseWeight);
  }

  const maximizing = seatToMove === aiSeat;
  const candidates = selectCandidatePositions(
    board,
    boardSize,
    seatToMove,
    neighborRadius,
    candidateLimit,
  );

  if (candidates.length === 0) {
    return evaluateBoard(board, boardSize, aiSeat, defenseWeight);
  }

  let alphaCursor = alpha;
  let betaCursor = beta;
  let bestScore = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (const position of candidates) {
    setCell(board, position, seatToMove);
    const score = hasFiveInRow(board, position, seatToMove)
      ? (seatToMove === aiSeat ? winScore : -winScore) + depth
      : minimax({
          aiSeat,
          alpha: alphaCursor,
          beta: betaCursor,
          board,
          boardSize,
          candidateLimit,
          defenseWeight,
          depth: depth - 1,
          neighborRadius,
          seatToMove: otherSeat(seatToMove),
        });
    setCell(board, position, null);

    if (maximizing) {
      bestScore = Math.max(bestScore, score);
      alphaCursor = Math.max(alphaCursor, score);
    } else {
      bestScore = Math.min(bestScore, score);
      betaCursor = Math.min(betaCursor, score);
    }

    if (betaCursor <= alphaCursor) {
      break;
    }
  }

  return bestScore;
}

function describeMove(board: BoardCell[][], position: Position, aiSeat: Seat): string {
  const opponentSeat = otherSeat(aiSeat);

  setCell(board, position, aiSeat);
  const attackLine = bestLineAtPosition(board, position, aiSeat);
  const winsNow = hasFiveInRow(board, position, aiSeat);
  setCell(board, position, null);

  if (winsNow) {
    return "Completes five in a row immediately.";
  }

  setCell(board, position, opponentSeat);
  const defenseLine = bestLineAtPosition(board, position, opponentSeat);
  const blocksWin = hasFiveInRow(board, position, opponentSeat);
  setCell(board, position, null);

  if (blocksWin) {
    return "Blocks an immediate five-in-a-row threat.";
  }

  if (attackLine.length >= 4 && attackLine.openEnds > 0) {
    return "Creates a forcing four-stone threat.";
  }

  if (defenseLine.length >= 4 && defenseLine.openEnds > 0) {
    return "Covers a dangerous four-stone lane.";
  }

  if (attackLine.length >= 3 && attackLine.openEnds === 2) {
    return "Builds an open three with room to extend.";
  }

  if (defenseLine.length >= 3 && defenseLine.openEnds === 2) {
    return "Reduces an opponent open-three pattern.";
  }

  return "Balances local shape, center control, and nearby threats.";
}

function selectScoredCandidate(
  candidates: ScoredCandidate[],
  topMoveCount: number,
  scoreWindow: number,
  mistakeChance: number,
): ScoredCandidate {
  const sorted = [...candidates].sort((left, right) => right.selectionScore - left.selectionScore);
  const best = sorted[0];

  if (!best) {
    throw new Error("AI could not find a legal move.");
  }

  const closeTopMoves = sorted
    .filter((candidate) => candidate.selectionScore >= best.selectionScore - scoreWindow)
    .slice(0, topMoveCount);
  const normalPool = closeTopMoves.length > 0 ? closeTopMoves : [best];
  const widerPool = sorted.slice(0, Math.max(topMoveCount + 2, normalPool.length));
  const selectionPool =
    Math.random() < mistakeChance && widerPool.length > 1 ? widerPool : normalPool;

  return selectionPool[Math.floor(Math.random() * selectionPool.length)] ?? best;
}

export function chooseAiMove({
  aiParticipantId,
  boardSize,
  difficultyId,
  moves,
  participants,
}: {
  aiParticipantId: string;
  boardSize: number;
  difficultyId: AiDifficultyId;
  moves: AiEngineMove[];
  participants: AiEngineParticipant[];
}): AiMoveChoice {
  const difficulty = getAiDifficulty(difficultyId);
  const aiSeat = participants.find((participant) => participant.id === aiParticipantId)?.seat;

  if (aiSeat !== "BLACK" && aiSeat !== "WHITE") {
    throw new Error("AI participant needs a player seat.");
  }

  const board = buildBoard(boardSize, participants, moves);
  const candidates = selectCandidatePositions(
    board,
    boardSize,
    aiSeat,
    difficulty.engine.neighborRadius,
    difficulty.engine.candidateLimit,
  );
  const scoredCandidates = candidates.map((position) => {
    setCell(board, position, aiSeat);
    const score = hasFiveInRow(board, position, aiSeat)
      ? winScore
      : minimax({
          aiSeat,
          alpha: Number.NEGATIVE_INFINITY,
          beta: Number.POSITIVE_INFINITY,
          board,
          boardSize,
          candidateLimit: difficulty.engine.candidateLimit,
          defenseWeight: difficulty.engine.defenseWeight,
          depth: Math.max(0, difficulty.engine.searchDepth - 1),
          neighborRadius: difficulty.engine.neighborRadius,
          seatToMove: otherSeat(aiSeat),
        });
    setCell(board, position, null);

    return {
      position,
      score,
      selectionScore: score + (Math.random() - 0.5) * difficulty.engine.tacticalNoise,
    };
  });
  const selected = selectScoredCandidate(
    scoredCandidates,
    difficulty.engine.topMoveCount,
    difficulty.engine.scoreWindow,
    difficulty.engine.mistakeChance,
  );
  const selectedFromTop =
    scoredCandidates
      .sort((left, right) => right.score - left.score)
      .findIndex((candidate) => candidate === selected) + 1;

  return {
    candidateCount: candidates.length,
    difficultyId: difficulty.id,
    position: selected.position,
    reason: describeMove(board, selected.position, aiSeat),
    score: Math.round(selected.score),
    searchedPlies: difficulty.engine.searchDepth,
    selectedFromTop: selectedFromTop > 0 ? selectedFromTop : 1,
  };
}
