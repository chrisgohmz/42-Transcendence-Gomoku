import type { Cell, Seat } from "../../../shared/match-events";

type RawMove = {
  participantId: string;
  moveNumber: number;
  x: number;
  y: number;
};

type RawParticipant = {
  id: string;
  seat: string | null;
};

export function buildBoard(
  boardSize: number,
  participants: RawParticipant[],
  moves: RawMove[],
): Cell[][] {
  const seatMap = new Map<string, Seat>();
  for (const p of participants) {
    if (p.seat === "BLACK" || p.seat === "WHITE") {
      seatMap.set(p.id, p.seat);
    }
  }

  const board: Cell[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, (): Cell => ({ occupied: false })),
  );

  const sorted = [...moves].sort((a, b) => a.moveNumber - b.moveNumber);
  for (const move of sorted) {
    const seat = seatMap.get(move.participantId);
    if (!seat) continue;

    if (move.x < 0 || move.y < 0 || move.x >= boardSize || move.y >= boardSize) {
      continue;
    }

    const row = board[move.y];
    if (!row) continue;

    row[move.x] = {
      occupied: true,
      seat,
      moveNumber: move.moveNumber,
    };
  }

  return board;
}
