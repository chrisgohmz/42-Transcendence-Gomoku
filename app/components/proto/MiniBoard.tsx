import type { Cell, Seat } from "../../../shared/match-events";

type Props = {
  board: Cell[][];
  disabled?: boolean;
  mySeat: Seat | null;
  nextTurnSeat: Seat | null;
  onCellClick: (x: number, y: number) => void;
};

export function MiniBoard({ board, disabled = false, mySeat, nextTurnSeat, onCellClick }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {board.map((row, y) => (
        <div key={y} style={{ display: "flex", gap: 4 }}>
          {row.map((cell, x) => {
            const isMyTurn = mySeat !== null && mySeat === nextTurnSeat;
            const clickable = !disabled && isMyTurn && !cell.occupied;

            return (
              <button
                key={x}
                type="button"
                onClick={() => clickable && onCellClick(x, y)}
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
