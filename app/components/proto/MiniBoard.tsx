import type { Cell } from "../../../shared/match-events";

type Props = {
  board: Cell[][];
  mySeat: "BLACK" | "WHITE" | null;
  nextTurnSeat: "BLACK" | "WHITE" | null;
  onCellClick: (x: number, y: number) => void;
};

export function MiniBoard({ board, mySeat, nextTurnSeat, onCellClick }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {board.map((row, y) => (
        <div key={y} style={{ display: "flex", gap: 4 }}>
          {row.map((cell, x) => {
            const isMyTurn = mySeat === nextTurnSeat;
            const clickable = isMyTurn && !cell.occupied;

            return (
              <button
                key={x}
                onClick={() => clickable && onCellClick(x, 0)}
                disabled={!clickable}
                style={{
                  width: 48,
                  height: 48,
                  background: cell.occupied ? (cell.seat === "BLACK" ? "#222" : "#eee") : "#ccc",
                  color: cell.occupied ? (cell.seat === "BLACK" ? "#eee" : "#222") : "#666",
                  border: "1px solid #999",
                  cursor: clickable ? "pointer" : "default",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                {cell.occupied ? `#${cell.moveNumber}` : ""}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
